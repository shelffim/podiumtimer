import { z } from "zod";
import { LIMITS } from "./billing";
import { MESSAGES } from "./messages";

export const TIMER_NAME_MAX = 60;
export const SEGMENT_NAME_MAX = 40;
export const NICKNAME_MAX = 20;
export const SEGMENT_MIN_SEC = 5;
export const SEGMENT_MAX_SEC = 3 * 60 * 60;

const copy = MESSAGES.validation;
const nameSchema = (max: number, tooLong: string) => z.string({ error: copy.nameRequired }).trim()
  .min(1, { error: copy.nameRequired }).max(max, { error: tooLong });
const numberSchema = z.number({ error: copy.invalidInput });
const millisecondsSchema = z.number({ error: copy.nonnegativeInteger })
  .int({ error: copy.nonnegativeInteger }).min(0, { error: copy.nonnegativeInteger });

export const segmentSchema = z.object({
  id: z.string({ error: copy.segmentIdRequired }).min(1, { error: copy.segmentIdRequired }),
  name: nameSchema(SEGMENT_NAME_MAX, copy.segmentNameTooLong),
  durationSec: z.number({ error: copy.durationRange }).int({ error: copy.durationRange })
    .min(SEGMENT_MIN_SEC, { error: copy.durationRange }).max(SEGMENT_MAX_SEC, { error: copy.durationRange }),
}, { error: copy.invalidInput });

export const timerInputSchema = z.object({
  name: nameSchema(TIMER_NAME_MAX, copy.timerNameTooLong),
  segments: z.array(segmentSchema, { error: copy.invalidInput }).max(LIMITS.pass.segments, { error: copy.segmentLimit }),
}, { error: copy.invalidInput });

export const runStateSchema = z.object({
  status: z.enum(["idle", "running", "finished", "aborted"], { error: copy.invalidInput }),
  startedAt: numberSchema.nullable(),
  transitions: z.array(numberSchema, { error: copy.invalidInput }),
  rev: z.number({ error: copy.invalidInput }).int({ error: copy.invalidInput }).min(0, { error: copy.invalidInput }),
}, { error: copy.invalidInput });

export const localRunSchema = z.object({
  segments: z.array(segmentSchema, { error: copy.invalidInput }),
  run: runStateSchema,
  shareCode: z.string({ error: copy.invalidInput }).nullable(),
}, { error: copy.invalidInput });

export const recordInputSchema = z.object({
  startedAt: numberSchema,
  segments: z.array(z.object({
    name: nameSchema(SEGMENT_NAME_MAX, copy.segmentNameTooLong),
    plannedMs: millisecondsSchema,
    actualMs: millisecondsSchema,
  }, { error: copy.invalidInput }), { error: copy.invalidInput }).min(1, { error: copy.recordSegmentsRequired }),
}, { error: copy.invalidInput });

export function parseClock(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+:[0-5]\d$/.test(trimmed)) return null;
  const [minutes, seconds] = trimmed.split(":").map(Number);
  return minutes * 60 + seconds;
}

export function sanitizeNickname(raw: string): string {
  return raw.replace(/[\p{Cc}\p{Cf}]/gu, "").trim();
}

export const nicknameSchema = z.string({ error: copy.nicknameLength }).transform(sanitizeNickname)
  .refine((nickname) => {
    const length = [...nickname].length;
    return length >= 1 && length <= NICKNAME_MAX;
  }, { error: copy.nicknameLength });

export function safeReturnTo(value: string | null | undefined, fallback = "/timers"): string {
  return value?.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") && !/\p{Cc}/u.test(value)
    ? value
    : fallback;
}
