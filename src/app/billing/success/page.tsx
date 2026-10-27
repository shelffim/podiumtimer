import { BillingSuccess } from "@/components/BillingSuccess";
import { PageShell } from "@/components/PageShell";
import { RequireAuth } from "@/components/RequireAuth";
import { safeReturnTo } from "@/lib/validation";

export default async function BillingSuccessPage({ searchParams }: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { returnTo } = await searchParams;
  const destination = safeReturnTo(typeof returnTo === "string" ? returnTo : undefined, "/timers");
  return <PageShell><RequireAuth><BillingSuccess returnTo={destination} /></RequireAuth></PageShell>;
}
