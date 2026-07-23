import Link from "next/link";
import { ArrowLeft, Clock, Cpu, ShieldCheck } from "lucide-react";
import InstantWizard from "@/components/InstantWizard";

export const metadata = {
  title: "Experimente — ArchTechTour Instant",
  description:
    "Envie a foto do seu produto e receba um modelo 3D navegável em minutos. Sem cadastro no primeiro teste.",
};

export default function ExperimentarPage() {
  return (
    <div className="min-h-screen bg-[#F5F3F0] text-[#0D0D0D]">
      <nav className="sticky top-0 z-50 border-b border-[#ECEAE6] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-3">
          <Link href="/" className="flex items-center gap-1.5 text-sm text-[#6B6760] transition hover:text-[#0D0D0D]">
            <ArrowLeft className="h-4 w-4" /> Início
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

      <header className="border-b border-[#ECEAE6] bg-white">
        <div className="mx-auto max-w-3xl px-5 py-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#E5E0DA] bg-[#F8F7F5] px-4 py-2 text-xs font-medium text-[#6B6760]">
            <Cpu className="h-3 w-3 text-[#A09890]" /> Geração automática · primeiro teste grátis
          </div>
          <h1 className="mb-4 text-3xl font-semibold tracking-tight md:text-5xl">
            Veja seu produto em 3D antes de fechar contrato.
          </h1>
          <p className="mx-auto max-w-xl text-sm text-[#6B6760]">
            Envie a foto de um produto do seu catálogo. Em poucos minutos ele volta como modelo 3D
            navegável, com realidade aumentada e uma nota de fidelidade medida por nós — sem maquiagem.
          </p>

          <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
            {[
              { icon: Clock, titulo: "Poucos minutos", texto: "Do envio ao 3D pronto para girar na tela." },
              { icon: ShieldCheck, titulo: "Avaliado antes de mostrar", texto: "Comparamos o modelo com sua foto e damos a nota." },
              { icon: Cpu, titulo: "Sem promessa falsa", texto: "Se o produto exigir modelagem artesanal, dizemos na hora." },
            ].map(({ icon: Icon, titulo, texto }) => (
              <div key={titulo} className="rounded-[16px] border border-[#E5E0DA] bg-[#F8F7F5] p-4">
                <Icon className="mb-2 h-4 w-4 text-[#0D0D0D]" />
                <p className="mb-1 text-sm font-semibold">{titulo}</p>
                <p className="text-xs leading-relaxed text-[#6B6760]">{texto}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      <InstantWizard />
    </div>
  );
}
