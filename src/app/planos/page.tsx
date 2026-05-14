"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, ArrowRight, ArrowLeft, Star } from "lucide-react";

const LOGO_URL = "https://www.archtechtour.com/wp-content/uploads/2025/09/logo-archtechtour-oficial.svg";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 1990,
    period: "mês",
    desc: "Para marcas iniciando no digital 3D.",
    blocks: 10,
    sla: "10 dias úteis/bloco",
    highlight: false,
    features: [
      "10 blocos 3D por período",
      "Upload de arquivos CAD/fotos",
      "Portal de acompanhamento",
      "Aprovação online dos blocos",
      "Suporte por e-mail",
      "NF-e automática",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 4490,
    period: "mês",
    desc: "Catálogo médio + customizador de RA.",
    blocks: 50,
    sla: "7 dias úteis/bloco",
    highlight: true,
    features: [
      "50 blocos 3D por período",
      "Customizador de Realidade Aumentada",
      "Variações interativas de acabamento",
      "Analytics avançado de downloads",
      "Prioridade na fila de produção",
      "Suporte prioritário (chat + e-mail)",
      "NF-e automática",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 0,
    period: "",
    desc: "Volume ilimitado com CSM dedicado.",
    blocks: 999,
    sla: "SLA negociado",
    highlight: false,
    features: [
      "Blocos ilimitados",
      "CSM dedicado",
      "SLA garantido em contrato",
      "Integração personalizada",
      "Relatórios executivos mensais",
      "Reuniões de alinhamento",
      "NF-e e Invoice internacional",
    ],
  },
];

const CURRENCIES = [
  { code: "BRL", symbol: "R$", flag: "🇧🇷", rate: 1 },
  { code: "USD", symbol: "$", flag: "🇺🇸", rate: 0.19 },
  { code: "EUR", symbol: "€", flag: "🇪🇺", rate: 0.17 },
  { code: "GBP", symbol: "£", flag: "🇬🇧", rate: 0.15 },
];

export default function PlanosPage() {
  const router = useRouter();
  const [currency, setCurrency] = useState("BRL");
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  const cur = CURRENCIES.find((c) => c.code === currency)!;
  const discount = billing === "yearly" ? 0.85 : 1;

  function formatPrice(price: number) {
    if (price === 0) return "Sob consulta";
    const converted = Math.round(price * discount * cur.rate);
    return `${cur.symbol} ${converted.toLocaleString()}`;
  }

  function handleSelect(planId: string) {
    if (planId === "enterprise") {
      window.location.href = "mailto:info@archtechtour.com?subject=Plano Enterprise - ArchTechTour";
      return;
    }
    router.push(`/contrato?plan=${planId}&billing=${billing}&currency=${currency}`);
  }

  return (
    <div className="min-h-screen bg-[#F5F3F0] text-[#0D0D0D]">
      {/* NAV */}
      <nav className="border-b border-[#ECEAE6] bg-white/95 backdrop-blur-xl sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-3">
          <Link href="/" className="flex items-center gap-1.5 text-sm text-[#6B6760] hover:text-[#0D0D0D] transition">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <div className="flex-1 flex items-center justify-center">
            <Link href="/">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LOGO_URL} alt="ArchTechTour" className="h-8 w-auto" />
            </Link>
          </div>
          <Link href="/portal" className="text-sm text-[#6B6760] hover:text-[#0D0D0D] transition">Entrar</Link>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-5 py-16">
        {/* HEADER */}
        <div className="text-center mb-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#E5E0DA] bg-white px-4 py-2 text-xs font-medium text-[#6B6760]">
            <Star className="h-3 w-3 text-[#A09890]" /> Fase 2 · Escolha seu plano
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#0D0D0D] md:text-5xl mb-4">
            Simples, transparente, sem surpresas
          </h1>
          <p className="text-[#6B6760] max-w-xl mx-auto text-sm">
            Sem vendedor. Escolha, pague e inicie o onboarding hoje.
          </p>
        </div>

        {/* BILLING + CURRENCY TOGGLES */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
          {/* Billing */}
          <div className="flex rounded-full border border-[#E5E0DA] bg-white p-1">
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${billing === "monthly" ? "bg-[#0D0D0D] text-white shadow-sm" : "text-[#6B6760] hover:text-[#0D0D0D]"}`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setBilling("yearly")}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all flex items-center gap-1.5 ${billing === "yearly" ? "bg-[#0D0D0D] text-white shadow-sm" : "text-[#6B6760] hover:text-[#0D0D0D]"}`}
            >
              Anual
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${billing === "yearly" ? "bg-white/20 text-white" : "bg-[#0D0D0D]/8 text-[#0D0D0D]"}`}>
                −15%
              </span>
            </button>
          </div>

          {/* Currency */}
          <div className="flex rounded-full border border-[#E5E0DA] bg-white p-1 gap-1">
            {CURRENCIES.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => setCurrency(c.code)}
                className={`rounded-full px-3 py-2 text-xs font-semibold transition-all flex items-center gap-1 ${currency === c.code ? "bg-[#0D0D0D] text-white shadow-sm" : "text-[#6B6760] hover:text-[#0D0D0D]"}`}
              >
                <span>{c.flag}</span> {c.code}
              </button>
            ))}
          </div>
        </div>

        {/* PLAN CARDS */}
        <div className="grid gap-5 md:grid-cols-3 mb-16">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-[24px] border p-6 transition-all ${
                plan.highlight
                  ? "border-[#0D0D0D] bg-[#0D0D0D]"
                  : "border-[#E5E0DA] bg-white"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/15 bg-white/10 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-white/70">
                  Mais popular
                </div>
              )}

              {/* Plan info */}
              <div className="mb-5">
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${plan.highlight ? "text-white/35" : "text-[#A09890]"}`}>{plan.name}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className={`text-4xl font-semibold ${plan.highlight ? "text-white" : "text-[#0D0D0D]"}`}>{formatPrice(plan.price)}</span>
                  {plan.period && <span className={`text-sm ${plan.highlight ? "text-white/35" : "text-[#A09890]"}`}>/{plan.period}</span>}
                </div>
                {billing === "yearly" && plan.price > 0 && (
                  <p className={`text-xs mb-1 ${plan.highlight ? "text-white/50" : "text-[#6B6760]"}`}>
                    Economiza {formatPrice(Math.round(plan.price * 0.15))}/mês no plano anual
                  </p>
                )}
                <p className={`text-sm mt-2 ${plan.highlight ? "text-white/50" : "text-[#6B6760]"}`}>{plan.desc}</p>
              </div>

              {/* SLA + Blocks */}
              <div className={`mb-5 rounded-xl border px-4 py-3 space-y-1 ${plan.highlight ? "border-white/10 bg-white/5" : "border-[#ECEAE6] bg-[#F8F7F5]"}`}>
                <p className={`text-xs ${plan.highlight ? "text-white/40" : "text-[#A09890]"}`}>
                  Blocos: <span className={`font-semibold ${plan.highlight ? "text-white" : "text-[#0D0D0D]"}`}>{plan.blocks === 999 ? "Ilimitados" : plan.blocks}</span>
                </p>
                <p className={`text-xs ${plan.highlight ? "text-white/40" : "text-[#A09890]"}`}>
                  SLA: <span className={`font-semibold ${plan.highlight ? "text-white" : "text-[#0D0D0D]"}`}>{plan.sla}</span>
                </p>
              </div>

              {/* Features */}
              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className={`flex items-start gap-2 text-sm ${plan.highlight ? "text-white/70" : "text-[#3A3630]"}`}>
                    <CheckCircle className={`h-4 w-4 flex-shrink-0 mt-0.5 ${plan.highlight ? "text-white/30" : "text-[#0D0D0D]"}`} />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => handleSelect(plan.id)}
                className={`mt-auto w-full rounded-xl py-3 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                  plan.highlight
                    ? "bg-white text-[#0D0D0D] hover:bg-neutral-100"
                    : "border border-[#0D0D0D] text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-white"
                }`}
              >
                {plan.id === "enterprise" ? "Falar com a equipe" : "Escolher este plano"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {/* COMPARISON TABLE */}
        <div className="mb-12">
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.3em] text-[#A09890] mb-6">Comparativo completo</p>
          <div className="overflow-hidden rounded-[20px] border border-[#E5E0DA] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#ECEAE6]">
                    <th className="px-5 py-4 text-left text-xs font-semibold text-[#A09890] min-w-[160px]">Recurso</th>
                    {PLANS.map((p) => (
                      <th key={p.id} className="px-5 py-4 text-center text-xs font-semibold text-[#3A3630]">{p.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Blocos 3D", "10", "50", "Ilimitado"],
                    ["Customizador RA", "—", "✓", "✓"],
                    ["Analytics", "Básico", "Avançado", "Executivo"],
                    ["Prioridade na fila", "Normal", "Alta", "Dedicada"],
                    ["Suporte", "E-mail", "Chat + e-mail", "CSM dedicado"],
                    ["Reuniões de alinhamento", "—", "—", "✓"],
                    ["NF-e / Invoice", "NF-e", "NF-e", "NF-e + Invoice"],
                  ].map(([feature, ...vals]) => (
                    <tr key={feature} className="border-b border-[#ECEAE6] last:border-0 hover:bg-[#F8F7F5] transition">
                      <td className="px-5 py-3.5 text-[#6B6760]">{feature}</td>
                      {vals.map((v, i) => (
                        <td key={i} className={`px-5 py-3.5 text-center font-medium ${v === "—" ? "text-[#C0BBB4]" : "text-[#0D0D0D]"}`}>
                          {v === "✓" ? <CheckCircle className="h-4 w-4 text-[#0D0D0D] mx-auto" /> : v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto space-y-3">
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.3em] text-[#A09890] mb-6">Perguntas frequentes</p>
          {[
            { q: "Posso cancelar a qualquer momento?", a: "Sim. Cancele pelo portal com 30 dias de antecedência. Sem multa." },
            { q: "Como funciona o pagamento?", a: "Cartão de crédito, Pix ou wire transfer. Cobrança automática mensal ou anual via Stripe." },
            { q: "A NF-e é emitida automaticamente?", a: "Sim. A NF-e é emitida automaticamente após cada cobrança confirmada e enviada por e-mail." },
            { q: "Posso mudar de plano depois?", a: "Sim. Upgrade ou downgrade a qualquer momento pelo portal, com ajuste proporcional." },
          ].map(({ q, a }) => (
            <div key={q} className="rounded-[16px] border border-[#E5E0DA] bg-white px-5 py-4">
              <p className="text-sm font-semibold text-[#0D0D0D] mb-1">{q}</p>
              <p className="text-sm text-[#6B6760]">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
