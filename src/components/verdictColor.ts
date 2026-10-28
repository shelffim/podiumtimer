import type { Verdict } from "@/types/timer";

// 판정 글자 색은 여기 한 곳에서만 정해요 (DESIGN.md 데이터/시맨틱 색상).
export const verdictColor: Record<Verdict, string> = {
  late: "text-red-400",
  early: "text-blue-400",
  on_time: "text-neutral-300",
};
