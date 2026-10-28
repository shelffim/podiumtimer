import { describe, expect, it } from "vitest";
import { computeOffset } from "./time";

describe("computeOffset", () => {
  it.each([[1_200, 1_000, 1_100, 150], [900, 1_000, 1_100, -150], [1_000, 1_000, 1_000, 0], [1_000, 1_000, 1_101, -50.5]])(
    "corrects server time %i over request %i to %i", (serverNow, requestedAt, receivedAt, expected) => {
      expect(computeOffset(serverNow, requestedAt, receivedAt)).toBe(expected);
    },
  );
});
