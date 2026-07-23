import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import InstantResultado from "@/components/InstantResultado";

export const metadata = {
  title: "Seu modelo 3D — ArchTechTour Instant",
};

export default function ResultadoPage({ params }: { params: { id: string } }) {
  return (
    <div className="min-h-screen bg-[#F5F3F0] text-[#0D0D0D]">
      <nav className="sticky top-0 z-50 border-b border-[#ECEAE6] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-3">
          <Link
            href="/experimentar"
            className="flex items-center gap-1.5 text-sm text-[#6B6760] transition hover:text-[#0D0D0D]"
          >
            <ArrowLeft className="h-4 w-4" /> Novo teste
          </Link>
          <div className="flex flex-1 items-center justify-center">
            <Link href="/">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="ArchTechTour" className="h-8 w-auto" />
            </Link>
          </div>
          <Link href="/planos" className="text-sm text-[#6B6760] transition hover:text-[#0D0D0D]">
            Planos
          </Link>
        </div>
      </nav>

      <InstantResultado id={params.id} />
    </div>
  );
}
