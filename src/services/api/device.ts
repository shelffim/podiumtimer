import { localRunSchema } from "@/lib/validation";
import type { LocalRun } from "@/types/run";

type Area = "local" | "session";

function storage(area: Area): Storage {
  return area === "local" ? localStorage : sessionStorage;
}

function read(key: string, area: Area = "local"): string | null {
  try {
    return storage(area).getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string, area: Area = "local"): void {
  try {
    storage(area).setItem(key, value);
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
  // 탭마다 따로 둬요. 같은 브라우저의 다른 탭도 접속자로 따로 세요.
  getClientId(): string {
    const saved = read("clientId", "session");
    if (saved) return saved;
    const id = crypto.randomUUID();
    write("clientId", id, "session");
    return id;
  },
  hasJoined(code: string): boolean {
    return read(`joined:${code}`) === "true";
  },
  markJoined(code: string): void {
    write(`joined:${code}`, "true");
  },
};
