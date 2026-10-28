"use client";

import { useEffect, useEffectEvent, useId, useRef } from "react";
import { MESSAGES } from "@/lib/messages";

export function ConfirmDialog({ title, description, confirmLabel, onConfirm, onCancel }: {
  title: string;
  description?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const id = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cancel = useEffectEvent(onCancel);

  useEffect(() => {
    cancelRef.current?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") cancel();
    }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, []);

  return (
    <div data-no-advance className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-5">
      <div role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined}
        className="flex w-full max-w-[360px] flex-col gap-5 rounded-3xl bg-card p-6">
        <div className="flex flex-col gap-2">
          <h2 id={`${id}-title`} className="heading">{title}</h2>
          {description && <p id={`${id}-description`} className="text-sm text-soft">{description}</p>}
        </div>
        <div className="flex justify-end gap-3">
          <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={onCancel}>{MESSAGES.common.cancel}</button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
