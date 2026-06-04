import BookingClient from "./booking-client";

export default async function BookingPage({ params }: { params: Promise<{ clinicSlug: string }> }) {
  const { clinicSlug } = await params;
  return <BookingClient clinicSlug={clinicSlug} />;
}

export function generateStaticParams() {
  return [{ clinicSlug: "demo-clinic" }];
}
