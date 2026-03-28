import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Legal Noon — Compliance Regulatório",
  description:
    "Ferramenta de compliance regulatório para gestoras de fundos de investimento brasileiras.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full font-sans" style={{ backgroundColor: '#F2F2F2' }}>{children}</body>
    </html>
  );
}
