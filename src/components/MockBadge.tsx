import { MESSAGES } from "@/lib/messages";
import type { DataMode } from "@/services/api";

export function MockBadge({ mode }: { mode: DataMode }) {
  if (mode !== "mock") return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-2 z-50 flex justify-center px-4">
      <p className="rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-center text-xs text-amber-300">
        {MESSAGES.mockBadge}
      </p>
    </div>
  );
}
