import { describe, expect, it } from "vitest";
import type { PresenceMember, PresenceRole } from "@/types/share";
import { LIMITS } from "./billing";
import { admit, seatUsage } from "./seats";

const member = (clientId: string, joinedAt: number, role: PresenceRole = "viewer"): PresenceMember => ({ clientId, joinedAt, role, nickname: "참가자" });
const cap = LIMITS.free.seats;

describe("seats", () => {
  it("reserves one host seat even without a host in presence", () => {
    expect(seatUsage([], cap)).toEqual({ used: 1, full: false });
    expect(seatUsage([member("a", 0)], cap)).toEqual({ used: 2, full: false });
  });

  it("admits host devices without consuming viewer seats and rejects the third viewer", () => {
    const presence = [member("host-a", 5, "host"), member("host-b", 6, "host"), member("c", 3), member("b", 2), member("a", 1)];
    expect(admit(presence, "host-a", cap, "running")).toBe(true);
    expect(admit(presence, "host-b", cap, "running")).toBe(true);
    expect(admit(presence, "a", cap, "running")).toBe(true);
    expect(admit(presence, "b", cap, "running")).toBe(true);
    expect(admit(presence, "c", cap, "running")).toBe(false);
    expect(admit(presence, "missing", cap, "running")).toBe(false);
    expect(seatUsage(presence, cap)).toEqual({ used: cap, full: true });
  });

  it("breaks joinedAt ties by clientId independently of input order", () => {
    const presence = [member("c", 1), member("b", 1), member("a", 1)];
    presence.forEach(Object.freeze);
    Object.freeze(presence);
    expect(admit(presence, "a", cap, "running")).toBe(true);
    expect(admit(presence, "b", cap, "running")).toBe(true);
    expect(admit(presence, "c", cap, "running")).toBe(false);
    expect(presence[0].clientId).toBe("c");
  });

  it("deduplicates clientId using the earliest join", () => {
    const presence = [member("a", 99), member("b", 2), member("c", 3), member("a", 1)];
    expect(admit(presence, "a", cap, "running")).toBe(true);
    expect(admit(presence, "c", cap, "running")).toBe(false);
    expect(seatUsage([member("a", 99), member("a", 1)], cap)).toEqual({ used: 2, full: false });
  });

  it.each(["finished", "aborted"] as const)("admits every viewer once the run is %s", (status) => {
    const presence = [member("a", 1), member("b", 2), member("c", 3)];
    expect(admit(presence, "c", cap, status)).toBe(true);
    expect(admit(presence, "c", cap, "running")).toBe(false);
    expect(admit(presence, "c", cap, "idle")).toBe(false);
  });

  it("uses the supplied cap and reports full at the exact boundary", () => {
    const presence = Array.from({ length: LIMITS.pass.seats - 1 }, (_, index) => member(`viewer-${index}`, index));
    expect(seatUsage(presence, LIMITS.pass.seats)).toEqual({ used: LIMITS.pass.seats, full: true });
    expect(admit(presence, presence.at(-1)!.clientId, LIMITS.pass.seats, "running")).toBe(true);
    expect(admit([member("a", 0)], "a", 1, "running")).toBe(false);
    expect(seatUsage([], 1)).toEqual({ used: 1, full: true });
  });
});
