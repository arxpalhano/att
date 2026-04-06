import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ArchTechTour | Portal de Operações",
  description: "Portal de gestão operacional para pipeline de produção 3D",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full bg-slate-50">{children}</body>
    </html>
  );
}
