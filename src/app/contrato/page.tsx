"use client";
import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle, FileText, CreditCard, Receipt, ArrowRight, Lock, AlertTriangle, Building2, User } from "lucide-react";
import { useT } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const LOGO_URL = "/logo.svg";

const PLAN_NAMES: Record<string, string> = { starter: "Starter", pro: "Pro", enterprise: "Enterprise" };
const PLAN_PRICES: Record<string, number> = { starter: 1990, pro: 4490, enterprise: 0 };

type Step = "cadastro" | "contract" | "payment" | "nf";

interface CadastroForm {
  razaoSocial: string;
  cnpj: string;
  responsavel: string;
  email: string;
  telefone: string;
  endereco: string;
  senha: string;
  confirmarSenha: string;
}

function formatCNPJ(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) return digits.replace(/^(\d{2})(\d{4})(\d)/, "($1) $2-$3");
  return digits.replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
}

function ContratoContent() {
  const router = useRouter();
  const t = useT();
  const params = useSearchParams();
  const plan = params.get("plan") || "starter";
  const billing = params.get("billing") || "monthly";
  const currency = params.get("currency") || "BRL";

  const [step, setStep] = useState<Step>("cadastro");

  const [cadastro, setCadastro] = useState<CadastroForm>({
    razaoSocial: "", cnpj: "", responsavel: "", email: "",
    telefone: "", endereco: "", senha: "", confirmarSenha: "",
  });
  const [cadastroErrors, setCadastroErrors] = useState<Partial<CadastroForm>>({});
  const [cadastroLoading, setCadastroLoading] = useState(false);

  const [signed, setSigned] = useState(false);
  const [signing, setSigning] = useState(false);

  const [payForm, setPayForm] = useState({ method: "card", name: "", card: "", expiry: "", cvv: "", cpf: "", pixKey: "" });
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  const [nfStatus, setNfStatus] = useState<"generating" | "done">("generating");

  const price = PLAN_PRICES[plan] || 1990;
  const finalPrice = billing === "yearly" ? Math.round(price * 0.85) : price;
  const planName = PLAN_NAMES[plan] || "Starter";

  function validateCadastro(): boolean {
    const errors: Partial<CadastroForm> = {};
    if (!cadastro.razaoSocial.trim()) errors.razaoSocial = t("contract.error.required");
    if (!cadastro.cnpj || cadastro.cnpj.replace(/\D/g, "").length < 14) errors.cnpj = t("contract.error.cnpj");
    if (!cadastro.responsavel.trim()) errors.responsavel = t("contract.error.required");
    if (!cadastro.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cadastro.email)) errors.email = t("contract.error.email");
    if (!cadastro.telefone || cadastro.telefone.replace(/\D/g, "").length < 10) errors.telefone = t("contract.error.phone");
    if (!cadastro.endereco.trim()) errors.endereco = t("contract.error.required");
    if (!cadastro.senha || cadastro.senha.length < 8) errors.senha = t("contract.error.password");
    if (cadastro.senha !== cadastro.confirmarSenha) errors.confirmarSenha = t("contract.error.passwordMatch");
    setCadastroErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleCadastroSubmit() {
    if (!validateCadastro()) return;
    setCadastroLoading(true);
    setTimeout(() => { setCadastroLoading(false); setStep("contract"); }, 1000);
  }

  function handleSign() {
    setSigning(true);
    setTimeout(() => { setSigning(false); setSigned(true); }, 2000);
  }

  function handlePay() {
    if (payForm.method === "card" && (!payForm.name || !payForm.card || !payForm.expiry || !payForm.cvv)) {
      setPayError(t("contract.error.fillCard"));
      return;
    }
    setPayError("");
    setPaying(true);
    setTimeout(() => {
      setPaying(false);
      setStep("nf");
      setTimeout(() => {
        setNfStatus("done");
        try {
          const ts = Date.now();
          const clientId = `c_${ts}`;
          const contractId = `ct_${ts}`;
          const storedUsers = JSON.parse(localStorage.getItem("att_portal_users") || "[]");
          const newUser = { id: `u_${ts}`, email: cadastro.email.trim().toLowerCase(), password: cadastro.senha, name: cadastro.razaoSocial, role: "client", clientId, active: true };
          localStorage.setItem("att_portal_users", JSON.stringify([...storedUsers.filter((u: { email: string }) => u.email !== newUser.email), newUser]));
          const storedClients = JSON.parse(localStorage.getItem("att_portal_clients") || "[]");
          const newClient = { id: clientId, name: cadastro.razaoSocial, code: cadastro.cnpj.replace(/\D/g, "").slice(0, 8), contactEmail: cadastro.email.trim().toLowerCase(), active: true };
          localStorage.setItem("att_portal_clients", JSON.stringify([...storedClients.filter((c: { id: string }) => c.id !== clientId), newClient]));
          const storedContracts = JSON.parse(localStorage.getItem("att_portal_contracts") || "[]");
          const planBlocks: Record<string, number> = { starter: 10, pro: 50, enterprise: 999 };
          const newContract = { id: contractId, clientId, title: `Contrato ${planName} – ${new Date().getFullYear()}`, totalBlocks: planBlocks[plan] ?? 10, usedBlocks: 0, startDate: new Date().toISOString().slice(0, 10), active: true };
          localStorage.setItem("att_portal_contracts", JSON.stringify([...storedContracts, newContract]));
        } catch { /* ignore storage errors */ }
      }, 3000);
    }, 2500);
  }

  const STEPS = [
    { id: "cadastro", label: t("contract.step.register"), icon: User },
    { id: "contract", label: t("contract.step.contract"), icon: FileText },
    { id: "payment", label: t("contract.step.payment"), icon: CreditCard },
    { id: "nf", label: t("contract.step.invoice"), icon: Receipt },
  ];

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  function inputClass(error?: string) {
    return `w-full rounded-xl border ${error ? "border-rose-400 bg-rose-50" : "border-[#E5E0DA] bg-white"} px-4 py-2.5 text-sm text-[#0D0D0D] placeholder-[#A09890] outline-none focus:border-[#0D0D0D] transition`;
  }

  return (
    <div className="min-h-screen bg-[#F5F3F0] text-[#0D0D0D]">
      {/* NAV */}
      <nav className="border-b border-[#ECEAE6] bg-white/95 backdrop-blur-xl sticky top-0 z-50">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-3">
          <Link href="/planos" className="flex items-center gap-1.5 text-[#6B6760] hover:text-[#0D0D0D] transition text-sm">
            <ArrowLeft className="h-4 w-4" /> {t("nav.plans")}
          </Link>
          <div className="flex-1 flex items-center justify-center">
            <Link href="/">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LOGO_URL} alt="ArchTechTour" className="h-8 w-auto" />
            </Link>
          </div>
          <LanguageSwitcher theme="light" />
          <div className="flex items-center gap-1.5 text-xs text-[#A09890]">
            <Lock className="h-3.5 w-3.5" /> {t("secure")}
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-5 py-12">
        {/* PHASE LABEL */}
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#E5E0DA] bg-white px-4 py-2 text-xs font-medium text-[#6B6760]">
            <Receipt className="h-3.5 w-3.5 text-[#A09890]" /> {t("contract.badge")}
          </span>
        </div>

        {/* PROGRESS */}
        <div className="flex items-center gap-2 max-w-xl mx-auto mb-12">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex flex-1 items-center gap-2">
              <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${i <= stepIndex ? "bg-[#0D0D0D] text-white" : "bg-white border border-[#E5E0DA] text-[#A09890]"}`}>
                {i < stepIndex ? <CheckCircle className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-xs font-semibold ${i === stepIndex ? "text-[#0D0D0D]" : "text-[#A09890]"}`}>{s.label}</span>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px ${i < stepIndex ? "bg-[#0D0D0D]/30" : "bg-[#E5E0DA]"}`} />}
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            {/* STEP 0 — CADASTRO */}
            {step === "cadastro" && (
              <div className="rounded-[24px] border border-[#E5E0DA] bg-white p-6 md:p-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0D0D0D]">
                    <Building2 className="h-4 w-4 text-white" />
                  </div>
                  <h2 className="text-xl font-semibold text-[#0D0D0D]">{t("contract.company.title")}</h2>
                </div>
                <p className="text-sm text-[#6B6760] mb-7">
                  {t("contract.company.subtitle")}
                </p>

                <div className="space-y-5">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#A09890] mb-1.5">{t("contract.field.company")}</label>
                      <input value={cadastro.razaoSocial} onChange={(e) => setCadastro({ ...cadastro, razaoSocial: e.target.value })} placeholder="Empresa Exemplo LTDA" className={inputClass(cadastroErrors.razaoSocial)} />
                      {cadastroErrors.razaoSocial && <p className="mt-1 text-xs text-rose-500">{cadastroErrors.razaoSocial}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#A09890] mb-1.5">{t("contract.field.cnpj")}</label>
                      <input value={cadastro.cnpj} onChange={(e) => setCadastro({ ...cadastro, cnpj: formatCNPJ(e.target.value) })} placeholder="00.000.000/0001-00" className={inputClass(cadastroErrors.cnpj) + " font-mono"} />
                      {cadastroErrors.cnpj && <p className="mt-1 text-xs text-rose-500">{cadastroErrors.cnpj}</p>}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#A09890] mb-1.5">{t("contract.field.responsible")}</label>
                      <input value={cadastro.responsavel} onChange={(e) => setCadastro({ ...cadastro, responsavel: e.target.value })} placeholder="João da Silva" className={inputClass(cadastroErrors.responsavel)} />
                      {cadastroErrors.responsavel && <p className="mt-1 text-xs text-rose-500">{cadastroErrors.responsavel}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#A09890] mb-1.5">{t("contract.field.phone")}</label>
                      <input value={cadastro.telefone} onChange={(e) => setCadastro({ ...cadastro, telefone: formatPhone(e.target.value) })} placeholder="(11) 99999-9999" className={inputClass(cadastroErrors.telefone)} />
                      {cadastroErrors.telefone && <p className="mt-1 text-xs text-rose-500">{cadastroErrors.telefone}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#A09890] mb-1.5">{t("contract.field.email")}</label>
                    <input type="email" value={cadastro.email} onChange={(e) => setCadastro({ ...cadastro, email: e.target.value })} placeholder="contato@suaempresa.com.br" className={inputClass(cadastroErrors.email)} />
                    {cadastroErrors.email && <p className="mt-1 text-xs text-rose-500">{cadastroErrors.email}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#A09890] mb-1.5">{t("contract.field.address")}</label>
                    <input value={cadastro.endereco} onChange={(e) => setCadastro({ ...cadastro, endereco: e.target.value })} placeholder="Rua Exemplo, 123 — São Paulo/SP — CEP 00000-000" className={inputClass(cadastroErrors.endereco)} />
                    {cadastroErrors.endereco && <p className="mt-1 text-xs text-rose-500">{cadastroErrors.endereco}</p>}
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#A09890] mb-1.5">{t("contract.field.password")}</label>
                      <input type="password" value={cadastro.senha} onChange={(e) => setCadastro({ ...cadastro, senha: e.target.value })} placeholder="Mínimo 8 caracteres" className={inputClass(cadastroErrors.senha)} />
                      {cadastroErrors.senha && <p className="mt-1 text-xs text-rose-500">{cadastroErrors.senha}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#A09890] mb-1.5">{t("contract.field.confirmPassword")}</label>
                      <input type="password" value={cadastro.confirmarSenha} onChange={(e) => setCadastro({ ...cadastro, confirmarSenha: e.target.value })} placeholder="Repita a senha" className={inputClass(cadastroErrors.confirmarSenha)} />
                      {cadastroErrors.confirmarSenha && <p className="mt-1 text-xs text-rose-500">{cadastroErrors.confirmarSenha}</p>}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-xl border border-[#ECEAE6] bg-[#F8F7F5] px-4 py-3 mt-6">
                  <Lock className="h-3.5 w-3.5 text-[#A09890] flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-[#6B6760]">{t("contract.privacy")}</p>
                </div>

                <button
                  type="button"
                  onClick={handleCadastroSubmit}
                  disabled={cadastroLoading}
                  className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-[#0D0D0D] py-3.5 text-sm font-semibold text-white hover:bg-[#2A2A2A] transition disabled:opacity-50"
                >
                  {cadastroLoading ? (
                    <><div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> {t("contract.saving")}</>
                  ) : (
                    <>{t("contract.continueToContract")} <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
              </div>
            )}

            {/* STEP 1 — CONTRACT */}
            {step === "contract" && (
              <div className="rounded-[24px] border border-[#E5E0DA] bg-white p-6 md:p-8">
                <h2 className="text-xl font-semibold text-[#0D0D0D] mb-2">{t("contract.sign.title")}</h2>
                <p className="text-sm text-[#6B6760] mb-6">{t("contract.sign.subtitle")}</p>

                {/* Contract text — kept in Portuguese as legal document */}
                <div className="rounded-2xl bg-[#0D0D0D] p-6 h-72 overflow-y-auto text-xs text-white/50 leading-6 mb-6 space-y-3">
                  <p className="font-bold text-white/80 text-sm text-center">CONTRATO DE PRESTAÇÃO DE SERVIÇOS PARA FORNECIMENTO DE PRODUTOS EM AMBIENTE VIRTUAL</p>

                  <p>
                    <strong className="text-white/70">ATT ARQUITETURA E TECNOLOGIA LTDA — ARCH TECH TOUR</strong>, pessoa jurídica de direito privado, inscrita no CNPJ sob nº 45.726.133/0001-88, com sede na Rua Lauro Linhares, nº 2055, Sala 606, Trindade, Florianópolis/SC, CEP 88036-002, representada por <strong className="text-white/70">MARIANA PESCA ELOY DA SILVA</strong> (doravante &ldquo;<strong className="text-white/70">ARCH TECH TOUR</strong>&rdquo;) e{" "}
                    <strong className="text-white">{cadastro.razaoSocial || "[Razão Social]"}</strong>, inscrita no CNPJ sob nº <strong className="text-white">{cadastro.cnpj || "[CNPJ]"}</strong>, com sede em <strong className="text-white">{cadastro.endereco || "[Endereço]"}</strong>, representada por <strong className="text-white">{cadastro.responsavel || "[Responsável]"}</strong>, e-mail: <strong className="text-white">{cadastro.email || "[E-mail]"}</strong> (doravante &ldquo;<strong className="text-white/70">CONTRATANTE</strong>&rdquo;).
                  </p>

                  <p><strong className="text-white/70">1. OBJETO</strong></p>
                  <p><strong className="text-white/70">1.1</strong> A <strong className="text-white/70">ARCH TECH TOUR</strong> prestará serviço interativo de divulgação e intermediação por meio da publicação de Catálogo Digital, disponibilizando: (i) Otimização de Catálogo 3D; (ii) Customizador Virtual 3D com visualização em realidade aumentada via iFrame; (iii) Blocos 3D compatíveis com SketchUp, Revit e Archicad; (iv) Armazenamento de dados em servidores próprios; (v) Vitrine da Marca no site da <strong className="text-white/70">ARCH TECH TOUR</strong> — tudo conforme o plano <strong className="text-white">{planName}</strong> contratado.</p>

                  <p><strong className="text-white/70">2. DO PAGAMENTO</strong></p>
                  <p><strong className="text-white/70">2.1</strong> O <strong className="text-white/70">CONTRATANTE</strong> pagará à <strong className="text-white/70">ARCH TECH TOUR</strong> o valor de <strong className="text-white">{currency === "BRL" ? `R$ ${finalPrice.toLocaleString("pt-BR")}` : String(finalPrice)}/{billing === "monthly" ? "mês" : "ano"}</strong>, cobrado automaticamente via método de pagamento cadastrado.</p>
                  <p><strong className="text-white/70">2.2</strong> Na renovação haverá reajuste pelo IPCA ou índice oficial substituto.</p>
                  <p><strong className="text-white/70">2.3</strong> Em caso de rescisão antecipada, o <strong className="text-white/70">CONTRATANTE</strong> autoriza a cobrança integral dos valores pactuados.</p>
                  <p><strong className="text-white/70">2.4</strong> Em caso de inadimplência, o <strong className="text-white/70">CONTRATANTE</strong> será inscrito nos órgãos de proteção ao crédito. Prazo de 5 dias úteis para regularização antes da exclusão da plataforma.</p>

                  <p><strong className="text-white/70">3. DA VIGÊNCIA, RESCISÃO E RENOVAÇÃO</strong></p>
                  <p><strong className="text-white/70">3.1</strong> O presente CONTRATO vigorará por 12 (doze) meses, contados da data de assinatura, sendo automaticamente renovado por períodos iguais, salvo manifestação expressa do <strong className="text-white/70">CONTRATANTE</strong> com antecedência mínima de 30 (trinta) dias.</p>
                  <p><strong className="text-white/70">3.2</strong> Em caso de não renovação ou rescisão, o customizador interativo será desabilitado em até 2 dias úteis e os modelos 3D serão entregues ao <strong className="text-white/70">CONTRATANTE</strong>.</p>

                  <p><strong className="text-white/70">4. PRIVACIDADE E LGPD</strong></p>
                  <p><strong className="text-white/70">4.1</strong> As partes se obrigam a cumprir a Lei nº 13.709/2018 (LGPD). Os dados pessoais serão tratados exclusivamente para os fins deste CONTRATO.</p>

                  <p><strong className="text-white/70">5. OBRIGAÇÕES DAS PARTES</strong></p>
                  <p><strong className="text-white/70">5.1</strong> A <strong className="text-white/70">ARCH TECH TOUR</strong> enviará um &ldquo;produto-modelo&rdquo; equivalente a 10% dos produtos contratados para aprovação. O <strong className="text-white/70">CONTRATANTE</strong> se compromete a enviar os arquivos necessários em até 10 dias úteis após o onboarding.</p>

                  <p><strong className="text-white/70">6. PROPRIEDADE INTELECTUAL</strong></p>
                  <p><strong className="text-white/70">6.1</strong> Os modelos 3D desenvolvidos são de direito do <strong className="text-white/70">CONTRATANTE</strong> e serão entregues no encerramento do contrato. O customizador e a plataforma são de propriedade exclusiva da <strong className="text-white/70">ARCH TECH TOUR</strong>.</p>

                  <p><strong className="text-white/70">7. DISPOSIÇÕES GERAIS</strong></p>
                  <p><strong className="text-white/70">7.1</strong> Este CONTRATO não gera relação de sociedade, franquia ou vínculo trabalhista entre as partes.</p>

                  <p><strong className="text-white/70">8. FORO</strong></p>
                  <p><strong className="text-white/70">8.1</strong> As partes elegem o Foro da Cidade de Florianópolis/SC para dirimir quaisquer conflitos relacionados a este CONTRATO.</p>

                  <p className="text-white/30 pt-2 border-t border-white/10">Ao clicar em &ldquo;Assinar digitalmente&rdquo;, o CONTRATANTE declara ter lido e aceito integralmente os termos acima, com a mesma validade jurídica de uma assinatura física, conforme MP 2.200-2/2001 e Lei 14.063/2020.</p>
                </div>

                {!signed ? (
                  <button onClick={handleSign} disabled={signing} className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0D0D0D] py-3.5 text-sm font-semibold text-white hover:bg-[#2A2A2A] transition disabled:opacity-50">
                    {signing ? (
                      <><div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> {t("contract.sign.processing")}</>
                    ) : (
                      <><FileText className="h-4 w-4" /> {t("contract.sign.btn")}</>
                    )}
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 rounded-xl border border-[#C0BBB4] bg-[#F8F7F5] p-4">
                      <CheckCircle className="h-5 w-5 text-[#0D0D0D] flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-[#0D0D0D]">{t("contract.sign.done")}</p>
                        <p className="text-xs text-[#6B6760] mt-0.5">ID: {`ATT-${Date.now().toString(36).toUpperCase()}`} · {new Date().toLocaleString("pt-BR")}</p>
                      </div>
                    </div>
                    <button onClick={() => setStep("payment")} className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0D0D0D] py-3.5 text-sm font-semibold text-white hover:bg-[#2A2A2A] transition">
                      {t("contract.continueToPayment")} <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2 — PAYMENT */}
            {step === "payment" && (
              <div className="rounded-[24px] border border-[#E5E0DA] bg-white p-6 md:p-8">
                <h2 className="text-xl font-semibold text-[#0D0D0D] mb-2">{t("contract.payment.title")}</h2>
                <p className="text-sm text-[#6B6760] mb-6">{t("contract.payment.subtitle")}</p>

                <div className="flex gap-2 mb-6">
                  {[
                    { id: "card", label: t("contract.payment.card") },
                    { id: "pix", label: "PIX" },
                    { id: "wire", label: "Wire Transfer" },
                  ].map((m) => (
                    <button key={m.id} onClick={() => setPayForm({ ...payForm, method: m.id })} className={`flex-1 rounded-xl py-2 text-xs font-semibold transition ${payForm.method === m.id ? "bg-[#0D0D0D] text-white" : "border border-[#E5E0DA] bg-white text-[#6B6760] hover:border-[#C0BBB4]"}`}>
                      {m.label}
                    </button>
                  ))}
                </div>

                {payForm.method === "card" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#A09890] mb-1.5">{t("contract.payment.nameOnCard")}</label>
                      <input value={payForm.name} onChange={(e) => setPayForm({ ...payForm, name: e.target.value })} placeholder="NOME SOBRENOME" className={inputClass()} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#A09890] mb-1.5">{t("contract.payment.cardNumber")}</label>
                      <input value={payForm.card} onChange={(e) => setPayForm({ ...payForm, card: e.target.value.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})/g, "$1 ").trim() })} placeholder="0000 0000 0000 0000" className={inputClass() + " font-mono"} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[#A09890] mb-1.5">{t("contract.payment.expiry")}</label>
                        <input value={payForm.expiry} onChange={(e) => setPayForm({ ...payForm, expiry: e.target.value })} placeholder="MM/AA" className={inputClass()} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[#A09890] mb-1.5">CVV</label>
                        <input value={payForm.cvv} onChange={(e) => setPayForm({ ...payForm, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="000" className={inputClass()} />
                      </div>
                    </div>
                  </div>
                )}

                {payForm.method === "pix" && (
                  <div className="rounded-xl border border-[#E5E0DA] bg-[#F8F7F5] p-6 text-center">
                    <div className="mx-auto mb-4 h-32 w-32 rounded-2xl bg-[#0D0D0D]/5 flex items-center justify-center">
                      <div className="grid grid-cols-5 gap-1">
                        {Array.from({ length: 25 }).map((_, i) => (
                          <div key={i} className={`h-3 w-3 rounded-sm ${[0,1,2,4,5,7,10,14,17,19,20,22,24].includes(i) ? "bg-[#0D0D0D]" : "bg-transparent"}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-[#0D0D0D] mb-1">QR Code PIX</p>
                    <p className="text-xs text-[#6B6760]">Escaneie com o app do seu banco</p>
                    <p className="text-xs text-[#A09890] mt-2">Chave: <span className="font-mono text-[#3A3630]">financeiro@archtechtour.com</span></p>
                    <p className="text-xs text-[#A09890] mt-1">Valor: <span className="font-semibold text-[#0D0D0D]">R$ {finalPrice.toLocaleString("pt-BR")}</span></p>
                  </div>
                )}

                {payForm.method === "wire" && (
                  <div className="rounded-xl border border-[#E5E0DA] bg-[#F8F7F5] p-6 space-y-3">
                    <p className="text-sm font-semibold text-[#0D0D0D] mb-3">Dados para transferência</p>
                    {[
                      ["Banco", "Itaú (341)"],
                      ["Agência", "0001-9"],
                      ["Conta", "12345-6"],
                      ["CNPJ", "45.726.133/0001-88"],
                      ["Razão social", "ATT Arquitetura e Tecnologia LTDA"],
                      ["Valor", `R$ ${finalPrice.toLocaleString("pt-BR")}`],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between text-sm">
                        <span className="text-[#6B6760]">{label}</span>
                        <span className="font-semibold text-[#0D0D0D]">{value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {payError && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                    <AlertTriangle className="h-4 w-4 text-rose-500 flex-shrink-0" />
                    <p className="text-xs text-rose-600">{payError}</p>
                  </div>
                )}

                <button onClick={handlePay} disabled={paying} className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-[#0D0D0D] py-3.5 text-sm font-semibold text-white hover:bg-[#2A2A2A] transition disabled:opacity-50">
                  {paying ? (
                    <><div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> {t("contract.payment.processing")}</>
                  ) : (
                    <><Lock className="h-4 w-4" /> {payForm.method === "pix" ? t("contract.payment.confirmPix") : payForm.method === "wire" ? t("contract.payment.confirmWire") : t("contract.payment.payNow")}</>
                  )}
                </button>

                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[#A09890]">
                  <Lock className="h-3 w-3" /> {t("contract.payment.stripe")}
                </div>
              </div>
            )}

            {/* STEP 3 — NF */}
            {step === "nf" && (
              <div className="rounded-[24px] border border-[#E5E0DA] bg-white p-6 md:p-8 text-center">
                {nfStatus === "generating" ? (
                  <div className="space-y-4">
                    <div className="mx-auto h-16 w-16 rounded-full border-4 border-[#E5E0DA] border-t-[#0D0D0D] animate-spin" />
                    <h2 className="text-xl font-semibold text-[#0D0D0D]">{t("contract.nf.generating")}</h2>
                    <p className="text-sm text-[#6B6760]">{t("contract.nf.generatingDesc")}</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-center">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#0D0D0D]">
                        <CheckCircle className="h-10 w-10 text-white" />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-2xl font-semibold text-[#0D0D0D] mb-2">{t("contract.nf.done")}</h2>
                      <p className="text-[#6B6760] text-sm">{t("contract.nf.doneDesc")}</p>
                    </div>

                    <div className="rounded-xl border border-[#E5E0DA] bg-[#F8F7F5] p-5 text-left space-y-2">
                      {[
                        [t("contract.summary.company"), cadastro.razaoSocial],
                        ["CNPJ", cadastro.cnpj],
                        [t("contract.summary.plan"), planName],
                        ["Valor", `R$ ${finalPrice.toLocaleString("pt-BR")}/${billing === "monthly" ? t("contract.summary.monthly") : t("contract.summary.yearly")}`],
                        ["NF-e", `ATT-NF-${Date.now().toString(36).toUpperCase()}`],
                        ["Próxima cobrança", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR")],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between text-sm">
                          <span className="text-[#6B6760]">{label}</span>
                          <span className="font-semibold text-[#0D0D0D]">{value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl border border-[#E5E0DA] bg-[#0D0D0D] p-5 text-left space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">{t("contract.credentials")}</p>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/40">{t("contract.credEmail")}</span>
                        <span className="font-semibold text-white font-mono">{cadastro.email}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/40">{t("contract.credPassword")}</span>
                        <span className="font-semibold text-white font-mono">{"•".repeat(cadastro.senha.length)}</span>
                      </div>
                      <p className="text-xs text-white/30 pt-1">
                        {t("contract.credNote").replace("{email}", cadastro.email)}
                      </p>
                    </div>

                    <Link
                      href="/portal"
                      className="inline-flex items-center gap-2 rounded-xl bg-[#0D0D0D] px-8 py-3.5 text-sm font-semibold text-white hover:bg-[#2A2A2A] transition"
                    >
                      {t("contract.goPortal")} <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SIDEBAR — ORDER SUMMARY */}
          <div className="space-y-4">
            <div className="rounded-[20px] border border-[#E5E0DA] bg-white p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#A09890] mb-4">{t("contract.summary.title")}</p>
              <div className="space-y-3">
                {cadastro.razaoSocial && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6B6760]">{t("contract.summary.company")}</span>
                    <span className="font-semibold text-[#0D0D0D] truncate max-w-[140px] text-right">{cadastro.razaoSocial}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B6760]">{t("contract.summary.plan")}</span>
                  <span className="font-semibold text-[#0D0D0D]">{planName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B6760]">{t("contract.summary.billing")}</span>
                  <span className="font-semibold text-[#0D0D0D]">{billing === "monthly" ? t("contract.summary.monthly") : t("contract.summary.yearly")}</span>
                </div>
                {billing === "yearly" && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6B6760]">{t("contract.summary.discount")}</span>
                    <span className="font-semibold text-[#0D0D0D]">−15%</span>
                  </div>
                )}
                <div className="h-px bg-[#ECEAE6]" />
                <div className="flex justify-between">
                  <span className="text-sm font-semibold text-[#0D0D0D]">{t("contract.summary.total")}</span>
                  <span className="text-lg font-semibold text-[#0D0D0D]">R$ {finalPrice.toLocaleString("pt-BR")}<span className="text-sm text-[#A09890]">/{billing === "monthly" ? t("contract.summary.monthly") : t("contract.summary.yearly")}</span></span>
                </div>
              </div>
            </div>

            <div className="rounded-[20px] border border-[#E5E0DA] bg-white p-5 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#A09890] mb-2">{t("contract.included.title")}</p>
              {[
                t("contract.included.1"),
                t("contract.included.2"),
                t("contract.included.3"),
                t("contract.included.4"),
                t("contract.included.5"),
                t("contract.included.6"),
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-xs text-[#3A3630]">
                  <CheckCircle className="h-3.5 w-3.5 text-[#0D0D0D] flex-shrink-0 mt-0.5" /> {item}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-[#A09890] px-1">
              <Lock className="h-3.5 w-3.5" /> {t("contract.ssl")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ContratoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F3F0] flex items-center justify-center text-[#0D0D0D]">Carregando...</div>}>
      <ContratoContent />
    </Suspense>
  );
}
