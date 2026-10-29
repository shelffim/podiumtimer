import { describe, expect, it } from "vitest";
import { LIMITS } from "./billing";
import { MESSAGES } from "./messages";
import { createIdleRun } from "./timer";
import { TIMER_NAME_MAX, SEGMENT_NAME_MAX, NICKNAME_MAX, SEGMENT_MIN_SEC, SEGMENT_MAX_SEC, segmentSchema, timerInputSchema, runStateSchema, localRunSchema, recordInputSchema, parseClock, sanitizeNickname, nicknameSchema, safeReturnTo } from "./validation";

const segment = { id: "a", name: "도입", durationSec: 5 };

describe("input schemas", () => {
  it("exports the specified input bounds", () => {
    expect([TIMER_NAME_MAX, SEGMENT_NAME_MAX, NICKNAME_MAX, SEGMENT_MIN_SEC, SEGMENT_MAX_SEC]).toEqual([60, 40, 20, 5, 10_800]);
  });

  it("trims names", () => {
    expect(timerInputSchema.parse({ name: " 발표 ", segments: [segment] })).toEqual({ name: "발표", segments: [segment] });
    expect(segmentSchema.parse({ ...segment, name: " 도입 " }).name).toBe("도입");
  });

  it("requires at least one segment", () => {
    const result = timerInputSchema.safeParse({ name: "발표", segments: [] });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toMatchObject([{ path: ["segments"], message: MESSAGES.validation.segmentsRequired }]);
  });

  it.each([[60, true], [61, false], [0, false]])("validates timer name length %i", (length, success) => {
    expect(timerInputSchema.safeParse({ name: "가".repeat(length), segments: [segment] }).success).toBe(success);
  });

  it.each([[40, true], [41, false], [0, false]])("validates segment name length %i", (length, success) => {
    expect(segmentSchema.safeParse({ ...segment, name: "가".repeat(length) }).success).toBe(success);
  });

  it.each([[4, false], [5, true], [10_800, true], [10_801, false], [5.5, false], [NaN, false], [Infinity, false], ["5", false]])(
    "validates duration %s", (durationSec, success) => expect(segmentSchema.safeParse({ ...segment, durationSec }).success).toBe(success),
  );

  it("requires an id, rejects blank names and applies the absolute segment cap", () => {
    expect(segmentSchema.safeParse({ ...segment, id: "" }).success).toBe(false);
    expect(segmentSchema.safeParse({ ...segment, name: "  " }).success).toBe(false);
    expect(timerInputSchema.safeParse({ name: "  ", segments: [segment] }).success).toBe(false);
    for (const length of [LIMITS.free.segments + 1, LIMITS.pass.segments, LIMITS.pass.segments + 1]) {
      expect(timerInputSchema.safeParse({ name: "발표", segments: Array.from({ length }, () => ({ ...segment })) }).success).toBe(length <= LIMITS.pass.segments);
    }
  });

  it.each(["idle", "running", "finished", "aborted"])("accepts the %s run shape", (status) => {
    expect(runStateSchema.safeParse({ status, startedAt: null, transitions: [], rev: 0 }).success).toBe(true);
    expect(runStateSchema.safeParse({ status, startedAt: 0, transitions: [1_000.5], rev: 2 }).success).toBe(true);
  });

  it.each([
    { status: "paused" }, { startedAt: "0" }, { startedAt: Infinity }, { transitions: [null] },
    { transitions: [NaN] }, { rev: -1 }, { rev: 0.5 }, { rev: "1" },
  ])("rejects invalid run fields %j", (invalid) => {
    expect(runStateSchema.safeParse({ ...createIdleRun(), ...invalid }).success).toBe(false);
  });

  it("requires record segments and integer nonnegative milliseconds", () => {
    const valid = { startedAt: 0, segments: [{ name: "도입", plannedMs: 0, actualMs: 1 }] };
    expect(recordInputSchema.parse(valid)).toEqual(valid);
    expect(recordInputSchema.safeParse({ ...valid, segments: [] }).success).toBe(false);
    expect(recordInputSchema.safeParse({ ...valid, startedAt: "0" }).success).toBe(false);
    for (const field of ["plannedMs", "actualMs"] as const) {
      for (const value of [-1, 0.5, Infinity, NaN, "1"]) {
        expect(recordInputSchema.safeParse({ ...valid, segments: [{ ...valid.segments[0], [field]: value }] }).success).toBe(false);
      }
    }
  });

  it("provides localized messages and nested paths for field rendering", () => {
    const result = timerInputSchema.safeParse({ name: "", segments: [{ id: "", name: "", durationSec: 4 }] });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map(({ path }) => path)).toEqual([["name"], ["segments", 0, "id"], ["segments", 0, "name"], ["segments", 0, "durationSec"]]);
    const localized = Object.values(MESSAGES.validation);
    for (const issue of result.error.issues) expect(localized).toContain(issue.message);
    for (const schema of [segmentSchema, timerInputSchema, runStateSchema, recordInputSchema, nicknameSchema]) {
      const invalid = schema.safeParse({});
      expect(invalid.success).toBe(false);
      if (!invalid.success) for (const issue of invalid.error.issues) expect(localized).toContain(issue.message);
    }
  });
});

describe("localRunSchema", () => {
  it("composes existing segment and run validation with a nullable share code", () => {
    const local = { segments: [segment], run: createIdleRun(), shareCode: null };
    expect(localRunSchema.parse(local)).toEqual(local);
    expect(localRunSchema.parse({ ...local, shareCode: "code" }).shareCode).toBe("code");
    expect(localRunSchema.safeParse({ ...local, segments: [] }).success).toBe(true);
    for (const invalid of [null, {}, { ...local, shareCode: 1 }, { ...local, run: {} }, { ...local, segments: [{ ...segment, durationSec: 4 }] }]) {
      expect(localRunSchema.safeParse(invalid).success).toBe(false);
    }
  });
});

describe("parseClock", () => {
  it.each([["3:00", 180], [" 125:00 ", 7_500], ["0:04", 4], ["0:00", 0], ["180:01", 10_801], ["3:0", null], ["3:60", null], ["-3:00", null], ["3.5:00", null], ["3:00\n4:00", null], ["", null]])(
    "parses %s as %s without checking the duration range", (text, expected) => expect(parseClock(text)).toBe(expected),
  );

  it.each([["3", 180], [" 5 ", 300], ["180", 10_800], ["181", 10_860], ["0", 0], ["-3", null], ["3.5", null], ["3 0", null]])(
    "reads bare digits %s as whole minutes (%s seconds)", (text, expected) => expect(parseClock(text)).toBe(expected),
  );
});

describe("nicknames", () => {
  it("removes control and invisible format characters before trimming", () => {
    const raw = " \u0000\u0009가\u200b나\u202e\u007f\u0085\ufeff ";
    expect(sanitizeNickname(raw)).toBe("가나");
    expect(nicknameSchema.parse(raw)).toBe("가나");
    expect(nicknameSchema.parse("가나")).toBe("가나");
  });

  it.each([[" ", false], ["\u0000\u200b", false], ["가", true], ["가".repeat(20), true], ["가".repeat(21), false], ["😀".repeat(20), true], ["😀".repeat(21), false]])(
    "counts sanitized code points in %s", (raw, expected) => expect(nicknameSchema.safeParse(raw).success).toBe(expected),
  );
});

describe("safeReturnTo", () => {
  it.each([null, undefined, "", "//evil.com", "/\\evil.com", "https://evil.com", "timers", "/timers\n", "/\u0000evil", "/\u0085evil"])(
    "rejects %s", (value) => {
      expect(safeReturnTo(value)).toBe("/timers");
      expect(safeReturnTo(value, "/pricing")).toBe("/pricing");
    },
  );

  it.each(["/", "/timers/a/run?source=pricing#ready", "/요금제", "/timers?next=https://example.com"])(
    "preserves internal path %s", (path) => expect(safeReturnTo(path)).toBe(path),
  );
});
