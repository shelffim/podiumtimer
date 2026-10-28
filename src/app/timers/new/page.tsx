import { PageShell } from "@/components/PageShell";
import { RequireAuth } from "@/components/RequireAuth";
import { TimerEditor } from "@/components/TimerEditor";

export default function NewTimerPage() {
  return <PageShell><RequireAuth><TimerEditor /></RequireAuth></PageShell>;
}
