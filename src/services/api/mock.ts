import { checkTimerLimit, computeExpiry, LIMITS, planOf } from "@/lib/billing";
import { createIdleRun } from "@/lib/timer";
import { recordInputSchema, runStateSchema, safeReturnTo, timerInputSchema } from "@/lib/validation";
import type { Api, ErrorCode, PlanStatus, Result, User } from "@/types/api";
import type { ShareView } from "@/types/share";
import type { RunRecord, Timer } from "@/types/timer";

type StoredShare = ShareView & { code: string; timerId: string };
type Order = { id: string; paidAt: number };
type Collection = "timers" | "records" | "shares" | "orders";

function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(`mock:${key}`) ?? "null");
  } catch {
    return null;
  }
}

function readList<T>(key: Collection): T[] {
  const value = read(key);
  return Array.isArray(value) ? value : [];
}

function write(key: string, value: unknown): void {
  localStorage.setItem(`mock:${key}`, JSON.stringify(value));
}

function readUser(): User | null {
  const value = read("user");
  return value !== null && typeof value === "object" && "id" in value && "email" in value
    && value.id === "mock-user" && value.email === null
    ? { id: value.id, email: null }
    : null;
}

const success = <T>(data: T): Result<T> => ({ ok: true, data });
const failure = (code: ErrorCode): Result<never> => ({ ok: false, code });

async function authenticated<T>(operation: () => Result<T>): Promise<Result<T>> {
  return readUser() ? operation() : failure("UNAUTHENTICATED");
}

function planStatus(): PlanStatus {
  const expiresAt = computeExpiry(readList<Order>("orders"));
  return { plan: planOf(expiresAt, Date.now()), expiresAt, timerCount: readList<Timer>("timers").length };
}

function shareCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const mockApi: Api = {
  async getUser() {
    return readUser();
  },
  async signIn() {
    write("user", { id: "mock-user", email: null });
  },
  async signOut() {
    localStorage.removeItem("mock:user");
  },
  listTimers() {
    return authenticated(() => success(readList<Timer>("timers")));
  },
  getTimer(id) {
    return authenticated(() => {
      const timer = readList<Timer>("timers").find((timer) => timer.id === id);
      return timer ? success(timer) : failure("NOT_FOUND");
    });
  },
  createTimer(input) {
    return authenticated(() => {
      const parsed = timerInputSchema.safeParse(input);
      if (!parsed.success) return failure("INVALID_INPUT");
      const timers = readList<Timer>("timers");
      const code = checkTimerLimit({
        plan: planStatus().plan, existingTimerCount: timers.length,
        segmentCount: parsed.data.segments.length, isNew: true,
      });
      if (code) return failure(code);
      const timer: Timer = { id: crypto.randomUUID(), ...parsed.data };
      write("timers", [...timers, timer]);
      return success(timer);
    });
  },
  updateTimer(id, input) {
    return authenticated(() => {
      const timers = readList<Timer>("timers");
      if (!timers.some((timer) => timer.id === id)) return failure("NOT_FOUND");
      const parsed = timerInputSchema.safeParse(input);
      if (!parsed.success) return failure("INVALID_INPUT");
      const code = checkTimerLimit({
        plan: planStatus().plan, existingTimerCount: timers.length,
        segmentCount: parsed.data.segments.length, isNew: false,
      });
      if (code) return failure(code);
      const timer: Timer = { id, ...parsed.data };
      write("timers", timers.map((current) => current.id === id ? timer : current));
      return success(timer);
    });
  },
  deleteTimer(id) {
    return authenticated(() => {
      const timers = readList<Timer>("timers");
      if (!timers.some((timer) => timer.id === id)) return failure("NOT_FOUND");
      write("timers", timers.filter((timer) => timer.id !== id));
      write("records", readList<RunRecord>("records").filter((record) => record.timerId !== id));
      write("shares", readList<StoredShare>("shares").filter((share) => share.timerId !== id));
      return success(null);
    });
  },
  listRecords(timerId) {
    return authenticated(() => {
      if (!readList<Timer>("timers").some((timer) => timer.id === timerId)) return failure("NOT_FOUND");
      return success(readList<RunRecord>("records")
        .filter((record) => record.timerId === timerId).sort((a, b) => b.startedAt - a.startedAt));
    });
  },
  saveRecord(timerId, startedAt, segments) {
    return authenticated(() => {
      if (!readList<Timer>("timers").some((timer) => timer.id === timerId)) return failure("NOT_FOUND");
      const parsed = recordInputSchema.safeParse({ startedAt, segments });
      if (!parsed.success) return failure("INVALID_INPUT");
      const record: RunRecord = { id: crypto.randomUUID(), timerId, ...parsed.data };
      write("records", [...readList<RunRecord>("records"), record]);
      return success(record);
    });
  },
  deleteRecord(id) {
    return authenticated(() => {
      const records = readList<RunRecord>("records");
      if (!records.some((record) => record.id === id)) return failure("NOT_FOUND");
      write("records", records.filter((record) => record.id !== id));
      return success(null);
    });
  },
  createShare(timerId) {
    return authenticated(() => {
      const timer = readList<Timer>("timers").find((timer) => timer.id === timerId);
      if (!timer) return failure("NOT_FOUND");
      const code = shareCode();
      const seatCap = LIMITS[planStatus().plan].seats;
      const share: StoredShare = {
        code, timerId, timerName: timer.name, segments: timer.segments,
        seatCap, state: createIdleRun(), rev: 0,
      };
      write("shares", [...readList<StoredShare>("shares"), share]);
      return success({ code, seatCap });
    });
  },
  updateShareState(code, run, start) {
    return authenticated(() => {
      const shares = readList<StoredShare>("shares");
      const share = shares.find((share) => share.code === code);
      if (!share) return failure("NOT_FOUND");
      const state = runStateSchema.safeParse(run);
      if (!state.success) return failure("INVALID_INPUT");
      const snapshot = start === undefined ? null : timerInputSchema.safeParse({ name: share.timerName, segments: start.segments });
      if (snapshot && !snapshot.success) return failure("INVALID_INPUT");
      const updated: StoredShare = {
        ...share, state: state.data, rev: state.data.rev,
        ...(snapshot?.success ? { segments: snapshot.data.segments, seatCap: LIMITS[planStatus().plan].seats } : {}),
      };
      // mock은 서버의 rev 조건부 업데이트를 흉내 내지 않아요.
      write("shares", shares.map((current) => current.code === code ? updated : current));
      return success(null);
    });
  },
  async getShare(code) {
    const share = readList<StoredShare>("shares").find((share) => share.code === code);
    if (!share) return failure("NOT_FOUND");
    const { timerName, segments, seatCap, state, rev } = share;
    return success({ timerName, segments, seatCap, state, rev });
  },
  getPlanStatus() {
    return authenticated(() => success(planStatus()));
  },
  startCheckout(returnTo) {
    return authenticated(() => {
      write("orders", [...readList<Order>("orders"), { id: crypto.randomUUID(), paidAt: Date.now() }]);
      return success({ url: `/billing/success?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}` });
    });
  },
  async getServerOffset() {
    return 0;
  },
};
