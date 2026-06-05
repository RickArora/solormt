import IntakeClient from "./intake-client";

export default async function IntakePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <IntakeClient token={token} />;
}

// Static export needs at least one param; real tokens are fetched client-side.
export function generateStaticParams() {
  return [{ token: "sample" }];
}
