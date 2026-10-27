import { PageShell } from "@/components/PageShell";
import { RequireAuth } from "@/components/RequireAuth";
import { RecordsView } from "@/components/RecordsView";

export default async function RecordsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PageShell><RequireAuth><RecordsView timerId={id} /></RequireAuth></PageShell>;
}
