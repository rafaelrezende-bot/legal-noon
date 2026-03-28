import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Legal Noon — Compliance Regulatório",
  description: "Ferramenta de compliance regulatório para gestoras de fundos de investimento brasileiras.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-gray-50 font-sans">
        <Sidebar />
        <main className="ml-[260px] min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
