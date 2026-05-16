"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useLanguage, Lang } from "@/lib/i18n";

const LANGS: { code: Lang; flag: string; label: string }[] = [
  { code: "pt", flag: "🇧🇷", label: "PT" },
  { code: "en", flag: "🇺🇸", label: "EN" },
  { code: "es", flag: "🇪🇸", label: "ES" },
  { code: "fr", flag: "🇫🇷", label: "FR" },
];

interface LanguageSwitcherProps {
  theme?: "dark" | "light";
}

export default function LanguageSwitcher({ theme = "light" }: LanguageSwitcherProps) {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isDark = theme === "dark";

  const buttonCls = isDark
    ? "flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/70 hover:text-white hover:bg-white/12 transition cursor-pointer"
    : "flex items-center gap-1.5 rounded-full border border-[#E5E0DA] bg-[#F8F7F5] px-3 py-1.5 text-xs font-semibold text-[#6B6760] hover:text-[#0D0D0D] hover:border-[#C0BBB4] transition cursor-pointer";

  const dropdownCls = isDark
    ? "absolute right-0 top-full mt-1.5 z-50 min-w-[110px] rounded-xl border border-white/10 bg-[#1A1A1A] py-1 shadow-xl"
    : "absolute right-0 top-full mt-1.5 z-50 min-w-[110px] rounded-xl border border-[#E5E0DA] bg-white py-1 shadow-lg";

  const itemCls = (active: boolean) =>
    isDark
      ? `flex items-center gap-2 w-full px-3 py-2 text-xs font-medium transition ${active ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/8"}`
      : `flex items-center gap-2 w-full px-3 py-2 text-xs font-medium transition ${active ? "text-[#0D0D0D] bg-[#F0EDE8]" : "text-[#6B6760] hover:text-[#0D0D0D] hover:bg-[#F8F7F5]"}`;

  return (
    <div ref={ref} className="relative">
      <button className={buttonCls} onClick={() => setOpen((o) => !o)}>
        <span>{current.flag}</span>
        <span>{current.label}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className={dropdownCls}>
          {LANGS.map((l) => (
            <button
              key={l.code}
              className={itemCls(l.code === lang)}
              onClick={() => { setLang(l.code); setOpen(false); }}
            >
              <span>{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
