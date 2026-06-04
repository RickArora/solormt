import AppPage from "../page";

export default async function ClinicAppPage({ params }: { params: Promise<{ clinicSlug: string }> }) {
  await params;
  return <AppPage />;
}

export function generateStaticParams() {
  return [{ clinicSlug: "demo-clinic" }];
}
