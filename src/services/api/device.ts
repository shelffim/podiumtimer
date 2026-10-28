import { localRunSchema } from "@/lib/validation";
import type { LocalRun } from "@/types/run";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 저장소를 쓸 수 없으면 복원 기능만 빠져요.
  }
}

export const device = {
  loadRun(timerId: string): LocalRun | null {
    try {
      const parsed = localRunSchema.safeParse(JSON.parse(read(`run:${timerId}`) ?? "null"));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  },
  saveRun(timerId: string, local: LocalRun): void {
    write(`run:${timerId}`, JSON.stringify(local));
  },
  clearRun(timerId: string): void {
    try {
      localStorage.removeItem(`run:${timerId}`);
    } catch {
      // 저장소를 쓸 수 없으면 복원 기능만 빠져요.
    }
  },
  loadNickname(): string | null {
    return read("nickname");
  },
  saveNickname(nickname: string): void {
    write("nickname", nickname);
  },
  getClientId(): string {
    const saved = read("clientId");
    if (saved) return saved;
    const id = crypto.randomUUID();
    write("clientId", id);
    return id;
  },
  hasJoined(code: string): boolean {
    return read(`joined:${code}`) === "true";
  },
  markJoined(code: string): void {
    write(`joined:${code}`, "true");
  },
};
