import { ViewerScreen } from "@/components/ViewerScreen";

export const dynamic = "force-dynamic";

export default async function ViewerPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <ViewerScreen key={code} code={code} contactEmail={process.env.CONTACT_EMAIL} />;
}
