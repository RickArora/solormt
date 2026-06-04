import ClientPortal from "./portal-client";

export default async function ClientPortalPage({ params }: { params: Promise<{ clinicSlug: string }> }) {
  const { clinicSlug } = await params;
  return <ClientPortal clinicSlug={clinicSlug} />;
}

export function generateStaticParams() {
  return [{ clinicSlug: "demo-clinic" }];
}
