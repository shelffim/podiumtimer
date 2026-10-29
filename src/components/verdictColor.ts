import type { Verdict } from "@/types/timer";

// 판정 글자 색은 여기 한 곳에서만 정해요 (DESIGN.md 데이터/시맨틱 색상).
export const verdictColor: Record<Verdict, string> = {
  late: "text-red-400",
  early: "text-blue-400",
  on_time: "text-neutral-300",
};

// 판정 배지는 같은 의미 색을 옅게 깐 바탕 위에 같은 글자 색을 써요.
export const verdictTone: Record<Verdict, string> = {
  late: "bg-red-400/15 text-red-400",
  early: "bg-blue-400/15 text-blue-400",
  on_time: "bg-white/10 text-neutral-300",
};
