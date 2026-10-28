import { Landing } from "@/components/Landing";
import { PageShell } from "@/components/PageShell";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;

  return (
    <PageShell>
      <Landing next={typeof next === "string" ? next : undefined} />
    </PageShell>
  );
}
