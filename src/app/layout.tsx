import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WTz AI Command Center",
  description: "Route your prompt to the right AI — or all of them",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <body style={{ height: "100%", margin: 0 }}>{children}</body>
    </html>
  );
}
