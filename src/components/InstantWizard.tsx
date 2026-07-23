"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight, ArrowLeft, Upload, X, Check, AlertTriangle,
  Info, Camera, Ruler, Sparkles,
} from "lucide-react";
import { CATEGORIAS, EXPECTATIVA_LABEL, type CategoriaInstant } from "@/lib/instant-categorias";

const TOM_CLASSES: Record<string, string> = {
  verde: "border-[#1F7A4D]/25 bg-[#1F7A4D]/8 text-[#1F7A4D]",
  ambar: "border-[#9A6B15]/25 bg-[#9A6B15]/8 text-[#9A6B15]",
  vermelho: "border-[#A32F26]/25 bg-[#A32F26]/8 text-[#A32F26]",
};

interface FotoLocal {
  file: File;
  url: string;
}

export default function InstantWizard() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [passo, setPasso] = useState(1);
  const [categoria, setCategoria] = useState<CategoriaInstant | null>(null);
  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const [dims, setDims] = useState({ altura: "", largura: "", profundidade: "" });
  const [produto, setProduto] = useState("");
  const [marca, setMarca] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function addFotos(files: FileList | null) {
    if (!files) return;
    const novos = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 4 - fotos.length)
      .map((file) => ({ file, url: URL.createObjectURL(file) }));
    setFotos((f) => [...f, ...novos]);
  }

  function removeFoto(i: number) {
    setFotos((f) => f.filter((_, idx) => idx !== i));
  }

  async function enviar() {
    if (!categoria || fotos.length === 0) return;
    setEnviando(true);
    setErro(null);
    try {
      const fd = new FormData();
      fd.append("categoria", categoria.id);
      fd.append("produto", produto || "produto");
      fd.append("marca", marca);
      fd.append("altura", dims.altura);
      fd.append("largura", dims.largura);
      fd.append("profundidade", dims.profundidade);
      fotos.forEach((f) => fd.append("fotos", f.file));

      const res = await fetch("/api/instant/gerar", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || "Falha ao enviar");
      router.push(`/experimentar/${data.id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado");
      setEnviando(false);
    }
  }

  const bloqueada = categoria && !categoria.automatico;
  const podeAvancar1 = !!categoria;
  const podeAvancar2 = fotos.length > 0;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      {/* PASSOS */}
      <ol className="mb-10 flex items-center justify-center gap-2 text-xs">
        {[
          { n: 1, label: "Categoria", icon: Sparkles },
          { n: 2, label: "Fotos", icon: Camera },
          { n: 3, label: "Medidas", icon: Ruler },
        ].map(({ n, label, icon: Icon }, i) => (
          <li key={n} className="flex items-center gap-2">
            {i > 0 && <span className="h-px w-6 bg-[#E5E0DA]" aria-hidden="true" />}
            <span
              className={`flex items-center gap-2 rounded-full border px-3.5 py-2 font-semibold transition ${
                passo === n
                  ? "border-[#0D0D0D] bg-[#0D0D0D] text-white"
                  : passo > n
                  ? "border-[#E5E0DA] bg-white text-[#0D0D0D]"
                  : "border-[#E5E0DA] bg-white text-[#A09890]"
              }`}
            >
              {passo > n ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              {label}
            </span>
          </li>
        ))}
      </ol>

      {/* PASSO 1 — CATEGORIA */}
      {passo === 1 && (
        <section>
          <h2 className="mb-1.5 text-2xl font-semibold tracking-tight text-[#0D0D0D]">
            Que tipo de produto você quer testar?
          </h2>
          <p className="mb-6 text-sm text-[#6B6760]">
            A categoria define o que a geração automática consegue entregar. Somos diretos sobre isso
            antes de você perder tempo.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {CATEGORIAS.map((c) => {
              const sel = categoria?.id === c.id;
              const badge = EXPECTATIVA_LABEL[c.expectativa];
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoria(c)}
                  aria-pressed={sel}
                  className={`rounded-[18px] border p-4 text-left transition-all ${
                    sel
                      ? "border-[#0D0D0D] bg-white ring-1 ring-[#0D0D0D]"
                      : "border-[#E5E0DA] bg-white hover:border-[#C0BBB4]"
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-[#0D0D0D]">{c.rotulo}</span>
                    {sel && <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#0D0D0D]" />}
                  </div>
                  <p className="mb-3 text-xs text-[#6B6760]">{c.descricao}</p>
                  <span
                    className={`inline-block rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      TOM_CLASSES[badge.tom]
                    }`}
                  >
                    {badge.texto}
                  </span>
                </button>
              );
            })}
          </div>

          {/* aviso honesto da categoria */}
          {categoria?.aviso && (
            <div
              className={`mt-5 flex gap-3 rounded-[16px] border p-4 ${
                bloqueada ? "border-[#A32F26]/25 bg-[#A32F26]/6" : "border-[#9A6B15]/25 bg-[#9A6B15]/6"
              }`}
            >
              <AlertTriangle
                className={`mt-0.5 h-4 w-4 flex-shrink-0 ${bloqueada ? "text-[#A32F26]" : "text-[#9A6B15]"}`}
              />
              <div className="space-y-1.5">
                <p className="text-sm text-[#3A3630]">{categoria.aviso}</p>
                {categoria.exemplo && (
                  <p className="text-xs text-[#6B6760]">{categoria.exemplo}</p>
                )}
              </div>
            </div>
          )}

          <div className="mt-7 flex justify-end">
            {bloqueada ? (
              <Link
                href="/planos"
                className="inline-flex items-center gap-2 rounded-xl bg-[#0D0D0D] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#262626]"
              >
                Ver planos com modelagem artesanal <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <button
                type="button"
                disabled={!podeAvancar1}
                onClick={() => setPasso(2)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0D0D0D] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#262626] disabled:cursor-not-allowed disabled:opacity-30"
              >
                Continuar <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </section>
      )}

      {/* PASSO 2 — FOTOS */}
      {passo === 2 && (
        <section>
          <h2 className="mb-1.5 text-2xl font-semibold tracking-tight text-[#0D0D0D]">
            Envie as fotos do produto
          </h2>
          <p className="mb-6 text-sm text-[#6B6760]">
            Uma foto já funciona. Quatro ângulos (frente, lados e costas) deixam o resultado bem melhor,
            porque o que não aparece na foto é o que a geração precisa deduzir.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => addFotos(e.target.files)}
          />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {fotos.map((f, i) => (
              <div key={f.url} className="group relative aspect-square overflow-hidden rounded-[16px] border border-[#E5E0DA] bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeFoto(i)}
                  aria-label={`Remover foto ${i + 1}`}
                  className="absolute right-2 top-2 rounded-full bg-[#0D0D0D]/70 p-1.5 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {fotos.length < 4 && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex aspect-square flex-col items-center justify-center gap-2 rounded-[16px] border border-dashed border-[#C0BBB4] bg-white text-[#6B6760] transition hover:border-[#0D0D0D] hover:text-[#0D0D0D]"
              >
                <Upload className="h-5 w-5" />
                <span className="text-xs font-semibold">Adicionar</span>
              </button>
            )}
          </div>

          <div className="mt-5 flex gap-3 rounded-[16px] border border-[#E5E0DA] bg-white p-4">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#A09890]" />
            <div className="text-xs leading-relaxed text-[#6B6760]">
              <p className="mb-1 font-semibold text-[#3A3630]">O que ajuda o resultado</p>
              Produto sozinho no quadro, fundo claro e uniforme, peça inteira visível.
              Fotos com outros móveis colados podem contaminar o modelo — nosso controle de
              qualidade detecta isso e avisa você.
            </div>
          </div>

          <div className="mt-7 flex justify-between">
            <button
              type="button"
              onClick={() => setPasso(1)}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E5E0DA] bg-white px-5 py-3 text-sm font-semibold text-[#6B6760] transition hover:text-[#0D0D0D]"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <button
              type="button"
              disabled={!podeAvancar2}
              onClick={() => setPasso(3)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0D0D0D] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#262626] disabled:cursor-not-allowed disabled:opacity-30"
            >
              Continuar <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* PASSO 3 — MEDIDAS */}
      {passo === 3 && (
        <section>
          <h2 className="mb-1.5 text-2xl font-semibold tracking-tight text-[#0D0D0D]">
            Quais são as medidas reais?
          </h2>
          <p className="mb-6 text-sm text-[#6B6760]">
            A geração automática acerta a forma, mas não tem como saber o tamanho. Com as medidas,
            entregamos o bloco na escala correta — pronto para o arquiteto usar no projeto.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#A09890]">
                Nome do produto
              </span>
              <input
                value={produto}
                onChange={(e) => setProduto(e.target.value)}
                placeholder="Poltrona Aurora"
                className="w-full rounded-xl border border-[#E5E0DA] bg-white px-4 py-3 text-sm text-[#0D0D0D] outline-none transition focus:border-[#0D0D0D]"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#A09890]">
                Marca
              </span>
              <input
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                placeholder="Sua marca"
                className="w-full rounded-xl border border-[#E5E0DA] bg-white px-4 py-3 text-sm text-[#0D0D0D] outline-none transition focus:border-[#0D0D0D]"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {([
              ["altura", "Altura (cm)", "78"],
              ["largura", "Largura (cm)", "60"],
              ["profundidade", "Profundidade (cm)", "55"],
            ] as const).map(([campo, label, ph]) => (
              <label key={campo} className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#A09890]">
                  {label}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={dims[campo]}
                  onChange={(e) => setDims((d) => ({ ...d, [campo]: e.target.value }))}
                  placeholder={ph}
                  className="w-full rounded-xl border border-[#E5E0DA] bg-white px-4 py-3 text-sm tabular-nums text-[#0D0D0D] outline-none transition focus:border-[#0D0D0D]"
                />
              </label>
            ))}
          </div>

          <div className="mt-5 rounded-[16px] border border-[#E5E0DA] bg-white p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#A09890]">
              O que você recebe neste teste
            </p>
            <ul className="space-y-1.5 text-sm text-[#3A3630]">
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#1F7A4D]" />Modelo 3D navegável no navegador</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#1F7A4D]" />Visualização em realidade aumentada no celular</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#1F7A4D]" />Nota de fidelidade medida pelo nosso controle de qualidade</li>
              <li className="flex gap-2 text-[#6B6760]"><X className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#C0BBB4]" />Download dos arquivos e blocos BIM: só nos planos contratados</li>
            </ul>
          </div>

          {erro && (
            <p className="mt-4 rounded-xl border border-[#A32F26]/25 bg-[#A32F26]/6 px-4 py-3 text-sm text-[#A32F26]">
              {erro}
            </p>
          )}

          <div className="mt-7 flex justify-between">
            <button
              type="button"
              onClick={() => setPasso(2)}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E5E0DA] bg-white px-5 py-3 text-sm font-semibold text-[#6B6760] transition hover:text-[#0D0D0D]"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <button
              type="button"
              onClick={enviar}
              disabled={enviando}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0D0D0D] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#262626] disabled:opacity-40"
            >
              {enviando ? "Enviando..." : "Gerar meu 3D"} <Sparkles className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
