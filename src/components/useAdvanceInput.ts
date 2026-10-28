"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

/** Wires Space and touch taps to onAdvance, and returns the same guarded trigger for an on-screen button. */
export function useAdvanceInput({ enabled, targetRef, onAdvance }: {
  enabled: boolean;
  targetRef: RefObject<HTMLElement | null>;
  onAdvance: () => void;
}): () => void {
  const callback = useRef(onAdvance);
  const enabledRef = useRef(enabled);
  const lastAt = useRef(-Infinity);
  useEffect(() => {
    callback.current = onAdvance;
    enabledRef.current = enabled;
  });

  const attempt = useCallback(() => {
    if (!enabledRef.current) return;
    const at = Date.now();
    if (at - lastAt.current < 500) return;
    lastAt.current = at;
    callback.current();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const target = targetRef.current;
    let pointer: { id: number; x: number; y: number; moved: boolean } | null = null;
    const excluded = (node: EventTarget | null) => node instanceof Element
      && !!node.closest("button, a, [data-no-advance]");
    const editing = (node: EventTarget | null) => node instanceof Element
      && !!node.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');

    function keydown(event: KeyboardEvent) {
      if (event.code !== "Space" || editing(event.target) || editing(document.activeElement)) return;
      event.preventDefault();
      if (!event.repeat) attempt();
    }
    function down(event: PointerEvent) {
      pointer = null;
      if ((event.pointerType !== "touch" && event.pointerType !== "pen") || excluded(event.target)) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    }
    function move(event: PointerEvent) {
      if (pointer?.id === event.pointerId && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 10) pointer.moved = true;
    }
    function up(event: PointerEvent) {
      move(event);
      const valid = pointer?.id === event.pointerId && !pointer.moved && !excluded(event.target);
      pointer = null;
      if (valid) attempt();
    }
    function cancel() { pointer = null; }

    document.addEventListener("keydown", keydown);
    target?.addEventListener("pointerdown", down);
    target?.addEventListener("pointermove", move);
    target?.addEventListener("pointerup", up);
    target?.addEventListener("pointercancel", cancel);
    return () => {
      document.removeEventListener("keydown", keydown);
      target?.removeEventListener("pointerdown", down);
      target?.removeEventListener("pointermove", move);
      target?.removeEventListener("pointerup", up);
      target?.removeEventListener("pointercancel", cancel);
    };
  }, [enabled, targetRef, attempt]);

  return attempt;
}
