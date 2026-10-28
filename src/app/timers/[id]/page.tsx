import { PageShell } from "@/components/PageShell";
import { RequireAuth } from "@/components/RequireAuth";
import { TimerEditor } from "@/components/TimerEditor";

export default async function TimerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PageShell><RequireAuth><TimerEditor timerId={id} /></RequireAuth></PageShell>;
}
