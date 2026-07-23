"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles, AlertTriangle, Check, X, Info, Ruler, Smartphone,
  Lock, ArrowRight, Loader2,
} from "lucide-react";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string; "ios-src"?: string; alt?: string; poster?: string;
        ar?: boolean; "ar-modes"?: string; "camera-controls"?: boolean;
        "shadow-intensity"?: string; "environment-image"?: string;
        exposure?: string; "auto-rotate"?: boolean; "touch-action"?: string;
      };
    }
  }
}

interface Resultado {
  status: string;
  erro?: string;
  slug: string;
  produto?: string;
  marca?: string;
  categoria_rotulo?: string;
  nota?: number | null;
  rota?: "automatica" | "revisao" | "artesanal";
  mensagem_cliente?: string;
  qa?: {
    resumo?: string;
    problemas?: string[];
    partes_faltando?: string[];
    contaminacao?: boolean;
  };
  normalizacao?: {
    dims_cm?: number[];
    desvio_proporcao_pct?: Record<string, number>;
    alerta_proporcao?: boolean;
    polys_final?: number;
  };
  glb_url?: string;
  usdz_url?: string | null;
  comparativo_url?: string;
  foto_url?: string;
  segundos?: number;
}

const ETAPAS = ["Gerando o modelo", "Ajustando escala e padrão ATT", "Avaliando a fidelidade"];

const ROTA_UI = {
  automatica: {
    rotulo: "Aprovado no controle automático",
    classe: "border-[#1F7A4D]/25 bg-[#1F7A4D]/8 text-[#1F7A4D]",
    cta: "Quero meu catálogo assim",
    ctaSub: "Este produto está no padrão que publicamos sem intervenção manual.",
  },
  revisao: {
    rotulo: "Aprovado com revisão da equipe",
    classe: "border-[#9A6B15]/25 bg-[#9A6B15]/8 text-[#9A6B15]",
    cta: "Ver planos",
    ctaSub: "Um modelador nosso ajusta os pontos abaixo antes da publicação final.",
  },
  artesanal: {
    rotulo: "Precisa de modelagem artesanal",
    classe: "border-[#A32F26]/25 bg-[#A32F26]/8 text-[#A32F26]",
    cta: "Falar sobre modelagem artesanal",
    ctaSub: "É o trabalho que fazemos à mão nos planos Pro e Enterprise.",
  },
} as const;

export default function InstantResultado({ id }: { id: string }) {
  const [dados, setDados] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [etapa, setEtapa] = useState(0);

  useEffect(() => {
    import("@google/model-viewer").catch(() => {});
  }, []);

  useEffect(() => {
    let vivo = true;
    let tentativas = 0;
    async function puxar() {
      try {
        const res = await fetch(`/api/instant/${id}`, { cache: "no-store" });
        const d = await res.json();
        if (!vivo) return;
        if (!res.ok) {
          setErro(d.erro || "Não encontramos este teste.");
          return;
        }
        setDados(d);
        if (d.status !== "pronto" && d.status !== "erro") {
          tentativas += 1;
          setEtapa(Math.min(Math.floor(tentativas / 6), ETAPAS.length - 1));
          setTimeout(puxar, 5000);
        }
      } catch {
        if (vivo) setTimeout(puxar, 8000);
      }
    }
    puxar();
    return () => { vivo = false; };
  }, [id]);

  if (erro) {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center">
        <p className="mb-4 text-sm text-[#6B6760]">{erro}</p>
        <Link href="/experimentar" className="text-sm font-semibold text-[#0D0D0D] underline">
          Fazer um novo teste
        </Link>
      </div>
    );
  }

  // Falha no processamento: dizer com clareza, nunca deixar o cliente esperando
  if (dados?.status === "erro") {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-[#A32F26]/25 bg-[#A32F26]/8">
          <AlertTriangle className="h-6 w-6 text-[#A32F26]" />
        </div>
        <h2 className="mb-3 text-xl font-semibold text-[#0D0D0D]">
          Não conseguimos gerar seu modelo
        </h2>
        <p className="mb-8 text-sm leading-relaxed text-[#6B6760]">
          {dados.erro ||
            "Houve uma falha interna do serviço durante a geração. Nossa equipe já foi avisada — tente novamente em alguns minutos."}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/experimentar"
            className="inline-flex items-center gap-2 rounded-xl bg-[#0D0D0D] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#262626]"
          >
            Tentar novamente
          </Link>
          <Link
            href="/planos"
            className="inline-flex items-center gap-2 rounded-xl border border-[#E5E0DA] bg-white px-5 py-3 text-sm font-semibold text-[#6B6760] transition hover:text-[#0D0D0D]"
          >
            Ver planos
          </Link>
        </div>
      </div>
    );
  }

  if (!dados || dados.status !== "pronto") {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center">
        <Loader2 className="mx-auto mb-6 h-7 w-7 animate-spin text-[#0D0D0D]" />
        <h2 className="mb-2 text-xl font-semibold text-[#0D0D0D]">{ETAPAS[etapa]}…</h2>
        <p className="mb-8 text-sm text-[#6B6760]">
          Costuma levar de um a três minutos. Pode deixar esta página aberta.
        </p>
        <ol className="mx-auto max-w-xs space-y-2 text-left">
          {ETAPAS.map((e, i) => (
            <li
              key={e}
              className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm transition ${
                i < etapa
                  ? "border-[#E5E0DA] bg-white text-[#0D0D0D]"
                  : i === etapa
                  ? "border-[#0D0D0D] bg-white text-[#0D0D0D]"
                  : "border-[#E5E0DA] bg-white/50 text-[#A09890]"
              }`}
            >
              {i < etapa ? (
                <Check className="h-4 w-4 text-[#1F7A4D]" />
              ) : i === etapa ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="h-4 w-4 rounded-full border border-[#E5E0DA]" />
              )}
              {e}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const rota = (dados.rota || "revisao") as keyof typeof ROTA_UI;
  const ui = ROTA_UI[rota];
  const nota = typeof dados.nota === "number" ? dados.nota : null;
  const dims = dados.normalizacao?.dims_cm;
  const problemas = dados.qa?.problemas ?? [];

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      {/* cabeçalho do resultado */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#A09890]">
            {dados.marca || "Seu produto"} · {dados.categoria_rotulo}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0D0D0D] md:text-3xl">
            {dados.produto || "Modelo gerado"}
          </h1>
        </div>
        <span className={`rounded-full border px-3.5 py-2 text-xs font-bold uppercase tracking-wider ${ui.classe}`}>
          {ui.rotulo}
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        {/* viewer */}
        <div className="overflow-hidden rounded-[24px] border border-[#E5E0DA] bg-white">
          <div className="relative aspect-[4/3] bg-[#F8F7F5]">
            <model-viewer
              src={dados.glb_url}
              ios-src={dados.usdz_url || undefined}
              alt={`Modelo 3D de ${dados.produto || "produto"}`}
              camera-controls
              auto-rotate
              ar
              ar-modes="webxr scene-viewer quick-look"
              shadow-intensity="1"
              exposure="1.1"
              touch-action="pan-y"
              style={{ width: "100%", height: "100%", backgroundColor: "#F8F7F5" }}
            />
            <span className="pointer-events-none absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-[#0D0D0D]/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
              <Sparkles className="h-3 w-3" /> Gerado automaticamente
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#ECEAE6] px-5 py-3 text-xs text-[#6B6760]">
            <span className="inline-flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5" /> Abra no celular para ver em RA
            </span>
            {dims && (
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Ruler className="h-3.5 w-3.5" /> {dims[0]} × {dims[1]} × {dims[2]} cm
              </span>
            )}
            {dados.segundos && (
              <span className="tabular-nums">pronto em {Math.round(dados.segundos)}s</span>
            )}
          </div>
        </div>

        {/* avaliação honesta */}
        <div className="space-y-4">
          <div className="rounded-[24px] border border-[#E5E0DA] bg-white p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#A09890]">
              Nossa avaliação de fidelidade
            </p>
            {nota !== null && (
              <div className="mb-3 flex items-baseline gap-2">
                <span className="text-4xl font-semibold tabular-nums text-[#0D0D0D]">
                  {nota.toString().replace(".", ",")}
                </span>
                <span className="text-sm text-[#A09890]">de 10</span>
              </div>
            )}
            <p className="mb-4 text-sm text-[#3A3630]">{dados.qa?.resumo}</p>
            <p className="rounded-xl bg-[#F8F7F5] px-4 py-3 text-sm text-[#6B6760]">
              {dados.mensagem_cliente}
            </p>
          </div>

          {(problemas.length > 0 || dados.qa?.contaminacao) && (
            <div className="rounded-[24px] border border-[#E5E0DA] bg-white p-5">
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#A09890]">
                <AlertTriangle className="h-3.5 w-3.5 text-[#9A6B15]" /> O que encontramos
              </p>
              <ul className="space-y-2">
                {problemas.map((p) => (
                  <li key={p} className="flex gap-2 text-sm text-[#3A3630]">
                    <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-[#9A6B15]" />
                    {p}
                  </li>
                ))}
                {dados.qa?.contaminacao && (
                  <li className="flex gap-2 text-sm text-[#3A3630]">
                    <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-[#9A6B15]" />
                    Outros objetos da foto foram absorvidos pelo modelo
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* prova lado a lado */}
      {dados.comparativo_url && (
        <section className="mt-8 overflow-hidden rounded-[24px] border border-[#E5E0DA] bg-white">
          <div className="flex items-center justify-between gap-4 border-b border-[#ECEAE6] px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-[#0D0D0D]">Compare você mesmo</p>
              <p className="text-xs text-[#6B6760]">
                Sua foto e quatro ângulos do modelo, sem retoque nenhum.
              </p>
            </div>
          </div>
          <div className="grid gap-px bg-[#ECEAE6] sm:grid-cols-[1fr_2.6fr]">
            {dados.foto_url && (
              <figure className="bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={dados.foto_url} alt="Foto enviada" className="mx-auto max-h-56 w-auto rounded-xl" />
                <figcaption className="mt-2 text-center text-[10px] font-bold uppercase tracking-wider text-[#A09890]">
                  Foto enviada
                </figcaption>
              </figure>
            )}
            <figure className="bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dados.comparativo_url} alt="Quatro vistas do modelo gerado" className="w-full rounded-xl" />
              <figcaption className="mt-2 text-center text-[10px] font-bold uppercase tracking-wider text-[#A09890]">
                Modelo gerado · 4 ângulos
              </figcaption>
            </figure>
          </div>
        </section>
      )}

      {/* o que este teste não inclui + CTA */}
      <section className="mt-8 grid gap-5 md:grid-cols-2">
        <div className="rounded-[24px] border border-[#E5E0DA] bg-white p-5">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#A09890]">
            <Info className="h-3.5 w-3.5" /> O que este teste não inclui
          </p>
          <ul className="space-y-2 text-sm">
            {[
              "Download do modelo e dos blocos para SketchUp, Revit e Archicad",
              "Texturas e acabamentos oficiais da sua marca aplicados",
              "Customizador com troca de tecidos e cores",
              "Revisão de um modelador e prazo garantido por contrato",
            ].map((t) => (
              <li key={t} className="flex gap-2 text-[#6B6760]">
                <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#C0BBB4]" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col justify-between rounded-[24px] border border-[#0D0D0D] bg-[#0D0D0D] p-5 text-white">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/35">
              Próximo passo
            </p>
            <p className="mb-2 text-lg font-semibold leading-snug">{ui.ctaSub}</p>
            <p className="text-sm text-white/50">
              Nos planos contratados, seu catálogo inteiro vira bloco 3D com os arquivos liberados
              para os arquitetos que especificam seus produtos.
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/planos"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#0D0D0D] transition hover:bg-neutral-100"
            >
              {ui.cta} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/experimentar"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white/80 transition hover:text-white"
            >
              Testar outro produto
            </Link>
          </div>
        </div>
      </section>

      <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-[#A09890]">
        <X className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
        Este modelo foi gerado automaticamente por inteligência artificial a partir das suas fotos e
        avaliado pelo nosso controle de qualidade. Ele representa a forma do produto, não um
        levantamento técnico com medidas certificadas.
      </p>
    </div>
  );
}
