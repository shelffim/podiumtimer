"use client";

import { useEffect, useState } from "react";

export function useNow(offsetMs: number, active: boolean): number {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!active) return;
    let frameId: number;
    function update() {
      setNow(Date.now());
      frameId = requestAnimationFrame(update);
    }
    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [active]);

  return now + offsetMs;
}
