import { PageShell } from "@/components/PageShell";
import { RequireAuth } from "@/components/RequireAuth";
import { TimerList } from "@/components/TimerList";

export default function TimersPage() {
  return <PageShell><RequireAuth><TimerList /></RequireAuth></PageShell>;
}
