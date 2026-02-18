import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Viral Machine MVP",
  description: "Queue A/B short-form outputs"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
