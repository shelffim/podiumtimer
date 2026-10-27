import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PASS_MS } from "@/lib/billing";
import { createIdleRun } from "@/lib/timer";
import type { Result } from "@/types/api";
import type { RunState } from "@/types/run";
import type { TimerInput } from "@/types/timer";
import { mockApi } from "./mock";

const input: TimerInput = { name: "발표", segments: [{ id: "intro", name: "도입", durationSec: 60 }] };
const times = [{ name: "도입", plannedMs: 60_000, actualMs: 62_000 }];
const running: RunState = { status: "running", startedAt: 1_000, transitions: [], rev: 1 };
const failure = (code: string) => ({ ok: false, code });
function data<T>(result: Result<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.code);
  return result.data;
}
const withSegments = (length: number): TimerInput => ({
  ...input, segments: Array.from({ length }, (_, i) => ({ ...input.segments[0], id: String(i) })),
});

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(Date, "now").mockReturnValue(1_000_000);
});
afterEach(() => vi.restoreAllMocks());

describe("mock authentication", () => {
  it("signs in a fake user and signs out without deleting data", async () => {
    expect(await mockApi.getUser()).toBeNull();
    await mockApi.signIn("/timers/new");
    expect(await mockApi.getUser()).toEqual({ id: "mock-user", email: null });
    expect(JSON.parse(localStorage.getItem("mock:user")!)).toEqual({ id: "mock-user", email: null });
    const timer = data(await mockApi.createTimer(input));
    await mockApi.startCheckout("/timers");
    await mockApi.signOut();
    expect(localStorage.getItem("mock:user")).toBeNull();
    expect(await mockApi.getUser()).toBeNull();
    await mockApi.signIn();
    expect(data(await mockApi.getTimer(timer.id))).toEqual(timer);
    expect(data(await mockApi.getPlanStatus()).plan).toBe("pass");
  });

  it.each([
    ["listTimers", () => mockApi.listTimers()],
    ["getTimer", () => mockApi.getTimer("missing")],
    ["createTimer", () => mockApi.createTimer(input)],
    ["updateTimer", () => mockApi.updateTimer("missing", input)],
    ["deleteTimer", () => mockApi.deleteTimer("missing")],
    ["listRecords", () => mockApi.listRecords("missing")],
    ["saveRecord", () => mockApi.saveRecord("missing", 0, times)],
    ["deleteRecord", () => mockApi.deleteRecord("missing")],
    ["createShare", () => mockApi.createShare("missing")],
    ["updateShareState", () => mockApi.updateShareState("missing", running)],
    ["getPlanStatus", () => mockApi.getPlanStatus()],
    ["startCheckout", () => mockApi.startCheckout("/timers")],
  ] as const)("rejects unauthenticated %s without writing", async (_, call) => {
    const result = call();
    expect(result).toBeInstanceOf(Promise);
    expect(await result).toEqual(failure("UNAUTHENTICATED"));
    expect(localStorage.length).toBe(0);
  });

  it("uses the device clock without authentication", async () => {
    expect(await mockApi.getServerOffset()).toBe(0);
  });
});

describe("mock data", () => {
  beforeEach(async () => { await mockApi.signIn(); });

  it("creates UUID timers, trims input, and preserves creation order on update", async () => {
    const first = data(await mockApi.createTimer({ ...input, name: " 첫 발표 " }));
    const second = data(await mockApi.createTimer({ ...input, name: "둘째" }));
    expect(first.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
    expect(first.name).toBe("첫 발표");
    const updated = data(await mockApi.updateTimer(first.id, { ...input, name: "수정" }));
    expect(updated.id).toBe(first.id);
    expect(data(await mockApi.listTimers())).toEqual([updated, second]);
    expect(data(await mockApi.getTimer(first.id))).toEqual(updated);
  });

  it("rejects the fourth free timer and permits the same request after checkout", async () => {
    for (let i = 0; i < 3; i++) data(await mockApi.createTimer(input));
    expect(await mockApi.createTimer(input)).toEqual(failure("PLAN_LIMIT_TIMERS"));
    await mockApi.startCheckout("/timers/new");
    data(await mockApi.createTimer(input));
    expect(data(await mockApi.getPlanStatus())).toEqual({ plan: "pass", expiresAt: Date.now() + PASS_MS, timerCount: 4 });
  });

  it("checks segment limits on create and update, with no timer count limit on update", async () => {
    expect(await mockApi.createTimer(withSegments(11))).toEqual(failure("PLAN_LIMIT_SEGMENTS"));
    const timer = data(await mockApi.createTimer(withSegments(10)));
    expect(await mockApi.updateTimer(timer.id, withSegments(11))).toEqual(failure("PLAN_LIMIT_SEGMENTS"));
    data(await mockApi.createTimer(input));
    data(await mockApi.createTimer(input));
    data(await mockApi.updateTimer(timer.id, input));
    await mockApi.startCheckout("/timers");
    data(await mockApi.updateTimer(timer.id, withSegments(30)));
    data(await mockApi.createTimer(withSegments(11)));
    expect(await mockApi.createTimer(withSegments(31))).toEqual(failure("INVALID_INPUT"));
  });

  it("uses the shared timer schema and leaves storage unchanged on invalid input", async () => {
    expect(await mockApi.createTimer({ ...input, name: " " })).toEqual(failure("INVALID_INPUT"));
    const timer = data(await mockApi.createTimer(input));
    expect(await mockApi.updateTimer(timer.id, { ...input, segments: [{ ...input.segments[0], durationSec: 4 }] })).toEqual(failure("INVALID_INPUT"));
    expect(data(await mockApi.getTimer(timer.id))).toEqual(timer);
    data(await mockApi.createTimer({ ...input, segments: [] }));
  });

  it("returns NOT_FOUND for missing timers, records, and shares before validating input", async () => {
    const missing = failure("NOT_FOUND");
    expect(await mockApi.getTimer("missing")).toEqual(missing);
    expect(await mockApi.updateTimer("missing", { ...input, name: "" })).toEqual(missing);
    expect(await mockApi.deleteTimer("missing")).toEqual(missing);
    expect(await mockApi.listRecords("missing")).toEqual(missing);
    expect(await mockApi.saveRecord("missing", NaN, [])).toEqual(missing);
    expect(await mockApi.deleteRecord("missing")).toEqual(missing);
    expect(await mockApi.createShare("missing")).toEqual(missing);
    expect(await mockApi.updateShareState("missing", { ...running, rev: -1 })).toEqual(missing);
    expect(await mockApi.getShare("missing")).toEqual(missing);
  });

  it("deletes a timer with its records and shares while preserving other timers", async () => {
    const first = data(await mockApi.createTimer(input));
    const second = data(await mockApi.createTimer(input));
    data(await mockApi.saveRecord(first.id, 1, times));
    const keptRecord = data(await mockApi.saveRecord(second.id, 2, times));
    const removedShare = data(await mockApi.createShare(first.id));
    const keptShare = data(await mockApi.createShare(second.id));
    expect(await mockApi.deleteTimer(first.id)).toEqual({ ok: true, data: null });
    expect(data(await mockApi.listTimers())).toEqual([second]);
    expect(JSON.parse(localStorage.getItem("mock:records")!)).toEqual([keptRecord]);
    expect(await mockApi.getShare(removedShare.code)).toEqual(failure("NOT_FOUND"));
    expect((await mockApi.getShare(keptShare.code)).ok).toBe(true);
  });

  it("stores only record times, lists newest startedAt first, and deletes individual records", async () => {
    const timer = data(await mockApi.createTimer(input));
    const extra = [{ ...times[0], diffMs: 2_000, verdict: "late" }];
    const older = data(await mockApi.saveRecord(timer.id, 10, extra));
    const latest = data(await mockApi.saveRecord(timer.id, 30, times));
    const middle = data(await mockApi.saveRecord(timer.id, 20, times));
    expect(older).toEqual({ id: expect.any(String), timerId: timer.id, startedAt: 10, segments: times });
    expect(JSON.parse(localStorage.getItem("mock:records")!)[0]).toEqual(older);
    expect(data(await mockApi.listRecords(timer.id))).toEqual([latest, middle, older]);
    expect(await mockApi.deleteRecord(middle.id)).toEqual({ ok: true, data: null });
    expect(data(await mockApi.listRecords(timer.id))).toEqual([latest, older]);
  });

  it("validates records using the shared schema and filters by timer", async () => {
    const timer = data(await mockApi.createTimer(input));
    const other = data(await mockApi.createTimer(input));
    expect(await mockApi.saveRecord(timer.id, 0, [])).toEqual(failure("INVALID_INPUT"));
    expect(await mockApi.saveRecord(timer.id, NaN, times)).toEqual(failure("INVALID_INPUT"));
    expect(await mockApi.saveRecord(timer.id, 0, [{ ...times[0], actualMs: -1 }])).toEqual(failure("INVALID_INPUT"));
    data(await mockApi.saveRecord(timer.id, 0, times));
    expect(data(await mockApi.listRecords(other.id))).toEqual([]);
  });

  it("creates independent 128-bit base64url codes and an anonymous snapshot", async () => {
    const timer = data(await mockApi.createTimer(input));
    const random = vi.spyOn(crypto, "getRandomValues");
    const first = data(await mockApi.createShare(timer.id));
    const second = data(await mockApi.createShare(timer.id));
    expect(first.code).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(second.code).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(first.code).not.toBe(second.code);
    expect(first.code).not.toBe(timer.id);
    expect(random).toHaveBeenCalledWith(expect.any(Uint8Array));
    expect((random.mock.calls[0][0] as Uint8Array).byteLength).toBe(16);
    await mockApi.updateTimer(timer.id, { ...input, name: "수정", segments: [] });
    await mockApi.signOut();
    const share = data(await mockApi.getShare(first.code));
    expect(share).toEqual({ timerName: timer.name, segments: timer.segments, seatCap: 3, state: createIdleRun(), rev: 0 });
    expect(Object.keys(share).sort()).toEqual(["rev", "seatCap", "segments", "state", "timerName"]);
  });

  it("overwrites segments and current plan seats at start, then preserves them", async () => {
    const timer = data(await mockApi.createTimer(input));
    const { code } = data(await mockApi.createShare(timer.id));
    await mockApi.startCheckout("/timers");
    const segments = [{ id: "new", name: "본론", durationSec: 120 }];
    expect(await mockApi.updateShareState(code, running, { segments })).toEqual({ ok: true, data: null });
    expect(data(await mockApi.getShare(code))).toMatchObject({ segments, seatCap: 10, state: running, rev: 1 });
    vi.spyOn(Date, "now").mockReturnValue(1_000_000 + PASS_MS);
    const next = { ...running, rev: 2 };
    await mockApi.updateShareState(code, next);
    expect(data(await mockApi.getShare(code))).toMatchObject({ segments, seatCap: 10, state: next, rev: 2 });
    const newShare = data(await mockApi.createShare(timer.id));
    expect(newShare.seatCap).toBe(3);
    await mockApi.updateShareState(code, running, { segments });
    expect(data(await mockApi.getShare(code)).seatCap).toBe(3);
  });

  it("validates share writes and deliberately overwrites even an older rev in mock", async () => {
    const timer = data(await mockApi.createTimer(input));
    const { code } = data(await mockApi.createShare(timer.id));
    expect(await mockApi.updateShareState(code, { ...running, rev: -1 })).toEqual(failure("INVALID_INPUT"));
    expect(await mockApi.updateShareState(code, running, { segments: [{ ...input.segments[0], durationSec: 0 }] })).toEqual(failure("INVALID_INPUT"));
    expect(data(await mockApi.getShare(code)).rev).toBe(0);
    await mockApi.updateShareState(code, { ...running, rev: 5 });
    await mockApi.updateShareState(code, running);
    expect(data(await mockApi.getShare(code))).toMatchObject({ state: running, rev: 1 });
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com"])("sanitizes checkout returnTo %s", async (returnTo) => {
    expect(data(await mockApi.startCheckout(returnTo))).toEqual({ url: "/billing/success?returnTo=%2Ftimers" });
  });

  it("preserves internal checkout paths, stores orders, extends expiry and expires without deleting timers", async () => {
    const timer = data(await mockApi.createTimer(input));
    const returnTo = `/timers/${timer.id}/run?source=pricing`;
    expect(data(await mockApi.getPlanStatus())).toEqual({ plan: "free", expiresAt: null, timerCount: 1 });
    expect(data(await mockApi.startCheckout(returnTo))).toEqual({ url: `/billing/success?returnTo=${encodeURIComponent(returnTo)}` });
    const orders = JSON.parse(localStorage.getItem("mock:orders")!);
    expect(orders).toEqual([{ id: expect.any(String), paidAt: Date.now() }]);
    await mockApi.startCheckout(returnTo);
    expect(data(await mockApi.getPlanStatus()).expiresAt).toBe(Date.now() + 2 * PASS_MS);
    vi.spyOn(Date, "now").mockReturnValue(1_000_000 + 2 * PASS_MS);
    expect(data(await mockApi.getPlanStatus()).plan).toBe("free");
    expect(data(await mockApi.getTimer(timer.id))).toEqual(timer);
  });

  it("reads external tab changes on every call and does not retain returned mutations", async () => {
    const timer = data(await mockApi.createTimer(input));
    timer.segments[0].name = "외부 변경 아님";
    expect(data(await mockApi.getTimer(timer.id)).segments[0].name).toBe("도입");
    const external = { ...timer, name: "다른 탭" };
    localStorage.setItem("mock:timers", JSON.stringify([external]));
    expect(data(await mockApi.getTimer(timer.id))).toEqual(external);
    localStorage.setItem("mock:orders", JSON.stringify([{ id: "external", paidAt: Date.now() }]));
    expect(data(await mockApi.getPlanStatus()).plan).toBe("pass");
    localStorage.removeItem("mock:user");
    expect(await mockApi.listTimers()).toEqual(failure("UNAUTHENTICATED"));
  });

  it.each(["{broken", "null", "{}", "42", '"text"'])("treats broken mock storage %s as empty", async (raw) => {
    for (const key of ["timers", "records", "shares", "orders"]) localStorage.setItem(`mock:${key}`, raw);
    expect(data(await mockApi.listTimers())).toEqual([]);
    expect(await mockApi.getShare("missing")).toEqual(failure("NOT_FOUND"));
    expect(data(await mockApi.getPlanStatus())).toEqual({ plan: "free", expiresAt: null, timerCount: 0 });
    const timer = data(await mockApi.createTimer(input));
    expect(data(await mockApi.listRecords(timer.id))).toEqual([]);
    data(await mockApi.saveRecord(timer.id, 0, times));
    data(await mockApi.createShare(timer.id));
    data(await mockApi.startCheckout("/timers"));
    localStorage.setItem("mock:user", raw);
    expect(await mockApi.getUser()).toBeNull();
  });
});
