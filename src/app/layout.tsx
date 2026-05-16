import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";

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
      <body className="min-h-full text-slate-950">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
