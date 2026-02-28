import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cloud Agents",
  description: "Cloud Agents - Coming Soon",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
