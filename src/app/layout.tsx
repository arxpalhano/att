import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ArchTechTour | Portal Premium",
  description: "Portal de gestão e acompanhamento operacional da ArchTechTour",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full text-slate-950">{children}</body>
    </html>
  );
}
