import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TAPS — Tour Advance Prep System",
  description: "Pre-tour advance prep and gap analysis for production teams",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
