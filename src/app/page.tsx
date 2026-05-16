"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Play, CheckCircle, Star, Quote, Layers, Globe, Smartphone, Sparkles, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";

// ─── Vídeo de demonstração ─────────────────────────────────────────────────────
const VIDEO_EMBED_URL: string | null = "https://www.youtube.com/embed/ta6uwJaqvz4";
const LOGO_URL = "https://www.archtechtour.com/wp-content/uploads/2025/09/logo-archtechtour-oficial.svg";

const CLIENTS = [
  "Escal Móveis", "Wentz", "Tidelli", "Hunter Douglas",
  "Minimal Design", "WJ Luminárias", "Estúdio Bola", "DEXCO",
];

// Testimonials moved inside component to use translations

function VideoModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl aspect-video rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 hover:bg-black border border-white/10 transition"
        >
          <X className="h-4 w-4 text-white" />
        </button>

        {VIDEO_EMBED_URL ? (
          <iframe
            src={`${VIDEO_EMBED_URL}?autoplay=1&rel=0&modestbranding=1`}
            className="w-full h-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="w-full h-full bg-[#0D0D0D] flex flex-col items-center justify-center gap-6 text-center p-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-white/5">
              <Play className="h-9 w-9 text-white ml-1" />
            </div>
            <div>
              <p className="text-xl font-semibold text-white mb-2">{t("video.title")}</p>
              <p className="text-white/40 text-sm max-w-sm">
                {t("video.desc")}
              </p>
            </div>
            <a
              href="mailto:info@archtechtour.com?subject=Quero ver uma demo"
              className="mt-2 flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#0D0D0D] hover:bg-neutral-100 transition"
              onClick={(e) => e.stopPropagation()}
            >
              {t("video.requestDemo")} <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [showVideo, setShowVideo] = useState(false);
  const t = useT();

  const BENEFITS = [
    { icon: Layers, title: t("benefits.b1.title"), desc: t("benefits.b1.desc") },
    { icon: Globe, title: t("benefits.b2.title"), desc: t("benefits.b2.desc") },
    { icon: Smartphone, title: t("benefits.b3.title"), desc: t("benefits.b3.desc") },
    { icon: Sparkles, title: t("benefits.b4.title"), desc: t("benefits.b4.desc") },
  ];

  const STEPS = [
    { n: "01", title: t("steps.s1.title"), desc: t("steps.s1.desc") },
    { n: "02", title: t("steps.s2.title"), desc: t("steps.s2.desc") },
    { n: "03", title: t("steps.s3.title"), desc: t("steps.s3.desc") },
  ];

  const TESTIMONIALS = [
    { quote: t("testimonial.1.quote"), name: "Marcela F.", role: t("testimonial.1.role") },
    { quote: t("testimonial.2.quote"), name: "Rafael K.", role: t("testimonial.2.role") },
    { quote: t("testimonial.3.quote"), name: "Ana P.", role: t("testimonial.3.role") },
  ];

  const NUMBERS = [
    { value: "40+", label: t("numbers.countries") },
    { value: "500+", label: t("numbers.brands") },
    { value: "20K+", label: t("numbers.downloads") },
    { value: "7 dias", label: t("numbers.delivery") },
  ];

  return (
    <div className="min-h-screen bg-white text-[#0D0D0D]">
      {showVideo && <VideoModal onClose={() => setShowVideo(false)} />}

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-[#ECEAE6] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_URL} alt="ArchTechTour" className="h-9 w-auto" />
          </Link>

          <div className="hidden items-center gap-7 text-sm text-[#6B6760] sm:flex">
            <a href="#como-funciona" className="hover:text-[#0D0D0D] transition">{t("nav.howItWorks")}</a>
            <a href="#beneficios" className="hover:text-[#0D0D0D] transition">{t("nav.benefits")}</a>
            <a href="#planos" className="hover:text-[#0D0D0D] transition">{t("nav.plans")}</a>
            <a href="#clientes" className="hover:text-[#0D0D0D] transition">{t("nav.clients")}</a>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher theme="light" />
            <Link href="/portal" className="text-sm text-[#6B6760] hover:text-[#0D0D0D] transition">
              {t("nav.login")}
            </Link>
            <Link
              href="/planos"
              className="flex items-center gap-1.5 rounded-full bg-[#0D0D0D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2A2A2A] transition"
            >
              {t("nav.startNow")} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0D0D0D] px-5 pt-28 pb-24">
        {/* Subtle dot grid */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* Soft glow */}
        <div className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(255,255,255,0.05),transparent)]" />

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/50 tracking-wide">
            <Star className="h-3 w-3 text-white/30" />
            {t("hero.badge")}
          </div>

          <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-white md:text-[3.5rem]">
            {t("hero.title1")}
            <br className="hidden md:block" /> {t("hero.title2")}
            <br />
            <span className="text-white/40">{t("hero.title3")}</span>
          </h1>

          <p className="mx-auto mt-7 max-w-xl text-base leading-7 text-white/40">
            {t("hero.subtitle")}
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/planos"
              className="flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-semibold text-[#0D0D0D] hover:bg-neutral-100 transition"
            >
              {t("hero.seePlans")} <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              onClick={() => setShowVideo(true)}
              className="flex items-center gap-2 rounded-full border border-white/12 bg-white/4 px-7 py-3 text-sm font-semibold text-white/70 hover:text-white hover:bg-white/8 transition"
            >
              <Play className="h-3.5 w-3.5" /> {t("hero.seeDemo")}
            </button>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-white/25">
            {[t("hero.noApp"), t("hero.delivery"), t("hero.noContract")].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <CheckCircle className="h-3 w-3" /> {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEMO VISUAL ──────────────────────────────────────────────────────── */}
      <section id="demo" className="bg-[#F5F3F0] px-5 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#A09890] mb-2">{t("transformation.label")}</p>
            <h2 className="text-2xl font-semibold tracking-tight text-[#0D0D0D]">{t("transformation.title")}</h2>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-[#E5E0DA] bg-white shadow-sm">
            <div className="grid md:grid-cols-2 min-h-[340px]">
              {/* Left — input */}
              <div className="flex flex-col justify-center p-8 md:p-12 border-b md:border-b-0 md:border-r border-[#E5E0DA]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#A09890] mb-5">{t("transformation.youSend")}</p>
                <div className="space-y-3">
                  {[
                    { key: "send.jpg", ext: ".JPG", cls: "text-[#8B7355] bg-[#8B7355]/8 border-[#8B7355]/25" },
                    { key: "send.skp", ext: ".SKP", cls: "text-[#4F7CA6] bg-[#4F7CA6]/8 border-[#4F7CA6]/25" },
                    { key: "send.pdf", ext: ".PDF", cls: "text-[#6E5EA6] bg-[#6E5EA6]/8 border-[#6E5EA6]/25" },
                    { key: "send.dwg", ext: ".DWG", cls: "text-[#4A7A5A] bg-[#4A7A5A]/8 border-[#4A7A5A]/25" },
                  ].map((f) => (
                    <div key={f.key} className="flex items-center gap-3 rounded-xl border border-[#ECEAE6] bg-[#F8F7F5] px-4 py-3">
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${f.cls}`}>{f.ext}</span>
                      <span className="text-sm text-[#3A3630]">{t(f.key)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right — output */}
              <div className="flex flex-col justify-center p-8 md:p-12">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#A09890] mb-5">{t("transformation.weDeliver")}</p>
                <div className="space-y-3">
                  {[
                    { icon: "🧊", labelKey: "deliver.model", descKey: "deliver.model.desc" },
                    { icon: "🎨", labelKey: "deliver.customizer", descKey: "deliver.customizer.desc" },
                    { icon: "📱", labelKey: "deliver.ar", descKey: "deliver.ar.desc" },
                    { icon: "🌍", labelKey: "deliver.global", descKey: "deliver.global.desc" },
                    { icon: "📊", labelKey: "deliver.analytics", descKey: "deliver.analytics.desc" },
                  ].map((item) => (
                    <div key={item.labelKey} className="flex items-center gap-3 rounded-xl border border-[#ECEAE6] bg-[#F8F7F5] px-4 py-3">
                      <span className="text-lg leading-none">{item.icon}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0D0D0D]">{t(item.labelKey)}</p>
                        <p className="text-xs text-[#A09890]">{t(item.descKey)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-[#E5E0DA] bg-[#F8F7F5] px-8 py-4 flex items-center justify-between flex-wrap gap-3">
              <p className="text-xs text-[#A09890]">{t("transformation.footer")}</p>
              <span className="text-xs font-semibold text-[#0D0D0D]">{t("transformation.avgTime")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── NÚMEROS ──────────────────────────────────────────────────────────── */}
      <section className="border-y border-[#ECEAE6] bg-white px-5 py-14">
        <div className="mx-auto max-w-4xl grid grid-cols-2 gap-8 md:grid-cols-4">
          {NUMBERS.map((n) => (
            <div key={n.label} className="text-center">
              <p className="text-3xl font-semibold text-[#0D0D0D]">{n.value}</p>
              <p className="mt-1 text-xs text-[#A09890] tracking-wide uppercase">{n.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── COMO FUNCIONA ────────────────────────────────────────────────────── */}
      <section id="como-funciona" className="bg-[#F5F3F0] px-5 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-14">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#A09890] mb-3">{t("howItWorks.label")}</p>
            <h2 className="text-3xl font-semibold tracking-tight text-[#0D0D0D] md:text-4xl">
              {t("howItWorks.title")}
            </h2>
            <p className="mt-4 text-[#6B6760] max-w-lg mx-auto text-sm leading-7">
              {t("howItWorks.subtitle")}
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {STEPS.map((s, idx) => (
              <div key={s.n} className="relative rounded-[20px] border border-[#E5E0DA] bg-white p-7 hover:border-[#C0BBB4] transition">
                {idx < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-9 -right-2.5 z-10">
                    <ArrowRight className="h-4 w-4 text-[#C0BBB4]" />
                  </div>
                )}
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#0D0D0D]">
                  <span className="text-sm font-bold text-white">{s.n}</span>
                </div>
                <h3 className="text-sm font-semibold text-[#0D0D0D] mb-2">{s.title}</h3>
                <p className="text-sm leading-6 text-[#6B6760]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BENEFÍCIOS ───────────────────────────────────────────────────────── */}
      <section id="beneficios" className="bg-white px-5 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#A09890] mb-3">{t("benefits.label")}</p>
            <h2 className="text-3xl font-semibold tracking-tight text-[#0D0D0D] md:text-4xl">{t("benefits.title")}</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {BENEFITS.map((b) => (
              <div key={b.title} className="flex gap-5 rounded-[20px] border border-[#ECEAE6] bg-[#F8F7F5] p-6 hover:border-[#C0BBB4] transition">
                <div className="flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-xl bg-[#0D0D0D]">
                  <b.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#0D0D0D] mb-2">{b.title}</h3>
                  <p className="text-sm leading-6 text-[#6B6760]">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTOS ──────────────────────────────────────────────────────── */}
      <section className="bg-[#F5F3F0] px-5 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#A09890] mb-3">{t("testimonials.label")}</p>
            <h2 className="text-3xl font-semibold tracking-tight text-[#0D0D0D] md:text-4xl">{t("testimonials.title")}</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((item) => (
              <div key={item.name} className="rounded-[20px] border border-[#E5E0DA] bg-white p-6 flex flex-col gap-4">
                <Quote className="h-5 w-5 text-[#C0BBB4] flex-shrink-0" />
                <p className="text-sm leading-7 text-[#3A3630] flex-1">&ldquo;{item.quote}&rdquo;</p>
                <div className="pt-2 border-t border-[#ECEAE6]">
                  <p className="text-sm font-semibold text-[#0D0D0D]">{item.name}</p>
                  <p className="text-xs text-[#A09890] mt-0.5">{item.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CLIENTES ─────────────────────────────────────────────────────────── */}
      <section id="clientes" className="border-y border-[#ECEAE6] bg-white px-5 py-16">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#A09890] mb-8">
            {t("clients.label")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {CLIENTS.map((name) => (
              <div
                key={name}
                className="rounded-full border border-[#E5E0DA] bg-[#F8F7F5] px-5 py-2 text-sm font-medium text-[#3A3630] hover:border-[#C0BBB4] hover:bg-[#F0EDE8] transition"
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANOS ───────────────────────────────────────────────────────────── */}
      <section id="planos" className="bg-[#F5F3F0] px-5 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#A09890] mb-3">{t("plans.label")}</p>
            <h2 className="text-3xl font-semibold tracking-tight text-[#0D0D0D] md:text-4xl">{t("plans.title")}</h2>
            <p className="mt-4 text-sm text-[#6B6760]">{t("plans.subtitle")}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3 pt-4">
            {[
              {
                name: "Starter",
                price: "R$ 1.990",
                periodKey: "plans.perMonth" as const,
                descKey: "plans.starter.desc" as const,
                features: [
                  t("plans.starter.products"),
                  t("plans.f1"), t("plans.f2"), t("plans.f3"), t("plans.f4"),
                ],
                highlight: false,
              },
              {
                name: "Pro",
                price: "R$ 4.490",
                periodKey: "plans.perMonth" as const,
                descKey: "plans.pro.desc" as const,
                features: [
                  t("plans.pro.products"),
                  t("plans.f5"), t("plans.f6"), t("plans.f7"), t("plans.f8"), t("plans.f3"),
                ],
                highlight: true,
              },
              {
                name: "Enterprise",
                price: t("plans.underConsult"),
                periodKey: null,
                descKey: "plans.enterprise.desc" as const,
                features: [
                  t("plans.f14"), t("plans.f9"), t("plans.f10"), t("plans.f11"), t("plans.f12"), t("plans.f13"),
                ],
                highlight: false,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-[20px] border p-7 flex flex-col ${
                  plan.highlight
                    ? "border-[#0D0D0D] bg-[#0D0D0D]"
                    : "border-[#E5E0DA] bg-white"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/15 bg-white/10 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-white/70">
                    {t("plans.popular")}
                  </div>
                )}
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${plan.highlight ? "text-white/35" : "text-[#A09890]"}`}>
                  {plan.name}
                </p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className={`text-3xl font-semibold ${plan.highlight ? "text-white" : "text-[#0D0D0D]"}`}>{plan.price}</span>
                  {plan.periodKey && <span className={`text-sm ${plan.highlight ? "text-white/35" : "text-[#A09890]"}`}>{t(plan.periodKey)}</span>}
                </div>
                <p className={`text-xs mb-6 ${plan.highlight ? "text-white/35" : "text-[#A09890]"}`}>{t(plan.descKey)}</p>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-center gap-2 text-sm ${plan.highlight ? "text-white/70" : "text-[#3A3630]"}`}>
                      <CheckCircle className={`h-3.5 w-3.5 flex-shrink-0 ${plan.highlight ? "text-white/30" : "text-[#0D0D0D]"}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.name === "Enterprise" ? "mailto:info@archtechtour.com?subject=Plano Enterprise" : `/planos`}
                  className={`block w-full rounded-xl py-3 text-center text-sm font-semibold transition ${
                    plan.highlight
                      ? "bg-white text-[#0D0D0D] hover:bg-neutral-100"
                      : "border border-[#0D0D0D] text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-white"
                  }`}
                >
                  {plan.name === "Enterprise" ? t("plans.talkTeam") : t("plans.startNow")}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0D0D0D] px-5 py-28">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(255,255,255,0.03),transparent)]" />

        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/40">
            <Star className="h-3 w-3 text-white/25" /> {t("cta.badge")}
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-5xl mb-5">
            {t("cta.title1")}{" "}
            <span className="text-white/40">{t("cta.title2")}</span>
          </h2>
          <p className="text-white/35 mb-10 text-base max-w-lg mx-auto leading-7">
            {t("cta.subtitle")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/planos"
              className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-[#0D0D0D] hover:bg-neutral-100 transition"
            >
              {t("cta.seePlans")} <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="mailto:info@archtechtour.com"
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/4 px-8 py-3.5 text-sm font-semibold text-white/60 hover:text-white hover:bg-white/8 transition"
            >
              {t("cta.talkTeam")}
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/6 bg-[#0D0D0D] px-5 py-10">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_URL} alt="ArchTechTour" className="h-7 w-auto" />
            <span className="text-xs text-white/20">· {t("footer.tagline")}</span>
          </div>
          <div className="flex flex-wrap gap-6 text-xs text-white/25">
            <a href="#" className="hover:text-white/50 transition">{t("footer.terms")}</a>
            <a href="#" className="hover:text-white/50 transition">{t("footer.privacy")}</a>
            <a href="mailto:info@archtechtour.com" className="hover:text-white/50 transition">info@archtechtour.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
