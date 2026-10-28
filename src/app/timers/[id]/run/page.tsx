import { RequireAuth } from "@/components/RequireAuth";
import { RunScreen } from "@/components/RunScreen";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RequireAuth><RunScreen key={id} timerId={id} /></RequireAuth>;
}
