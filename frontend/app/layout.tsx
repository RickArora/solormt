import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SoloRMT",
  description: "Clinic management SaaS for independent massage therapists."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white font-sans text-ink antialiased">{children}</body>
    </html>
  );
}

