"use client";

import { useEffect, useState } from "react";
import { DEMO_LOOP_TICKS, DEMO_STILL, DEMO_TICK_MS, demoFrame, type DemoFrame } from "@/lib/demo";

export function useDemoFrame(): DemoFrame {
  const [frame, setFrame] = useState<DemoFrame>(DEMO_STILL);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let interval: ReturnType<typeof setInterval> | undefined;

    function start() {
      let tick = 0;
      interval = setInterval(() => {
        setFrame(demoFrame(tick));
        tick = (tick + 1) % DEMO_LOOP_TICKS;
      }, DEMO_TICK_MS);
    }

    function onMotionChange() {
      clearInterval(interval);
      if (motion.matches) setFrame(DEMO_STILL);
      else start();
    }

    if (!motion.matches) start();
    motion.addEventListener("change", onMotionChange);
    return () => {
      clearInterval(interval);
      motion.removeEventListener("change", onMotionChange);
    };
  }, []);

  return frame;
}
