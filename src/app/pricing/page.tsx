import { PageShell } from "@/components/PageShell";
import { PricingView } from "@/components/PricingView";
import { RequireAuth } from "@/components/RequireAuth";
import { safeReturnTo } from "@/lib/validation";

export default async function PricingPage({ searchParams }: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { returnTo } = await searchParams;
  const destination = safeReturnTo(typeof returnTo === "string" ? returnTo : undefined, "/timers");
  return <PageShell><RequireAuth><PricingView returnTo={destination} /></RequireAuth></PageShell>;
}
