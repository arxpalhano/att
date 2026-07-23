/**
 * Catálogo de categorias do ATT Instant (espelha pipeline/categorias.py).
 *
 * A honestidade com o cliente começa aqui: cada categoria carrega o que
 * esperar ANTES de gerar, com o exemplo real do nosso teste interno.
 */

export type Expectativa = "alta" | "media" | "baixa" | "bloqueada";

export interface CategoriaInstant {
  id: string;
  rotulo: string;
  descricao: string;
  expectativa: Expectativa;
  automatico: boolean;
  aviso?: string;
  exemplo?: string;
}

export const CATEGORIAS: CategoriaInstant[] = [
  {
    id: "mesa",
    rotulo: "Mesa, aparador ou bancada",
    descricao: "Tampos, bases e estruturas fechadas",
    expectativa: "alta",
    automatico: true,
    exemplo: "No nosso teste, mesas de tampo orgânico saíram com silhueta fiel.",
  },
  {
    id: "banco_pedra",
    rotulo: "Peça em pedra ou concreto",
    descricao: "Bancos, mesas laterais, esculturas",
    expectativa: "alta",
    automatico: true,
    exemplo: "O Banco Bacuri em travertino atingiu nota 8 de fidelidade.",
  },
  {
    id: "cadeira_madeira",
    rotulo: "Cadeira com estrutura de madeira",
    descricao: "Com ou sem braços, assento estofado",
    expectativa: "alta",
    automatico: true,
    exemplo: "Pernas cônicas e braços vazados foram preservados no nosso teste.",
  },
  {
    id: "estofado",
    rotulo: "Poltrona ou sofá estofado",
    descricao: "Volumes macios, almofadas, gomos",
    expectativa: "media",
    automatico: true,
    aviso:
      "Estofados usam nosso motor mais avançado. Costuras e gomos saem bem, mas a trama exata do tecido é substituída pela biblioteca de texturas da sua marca.",
    exemplo: "Uma poltrona de bouclé saiu com gomos do encosto e vinco do assento definidos.",
  },
  {
    id: "tubular",
    rotulo: "Estrutura tubular ou vazada",
    descricao: "Metal tubular, bases aparentes",
    expectativa: "media",
    automatico: true,
    aviso: "Estruturas vazadas costumam sair bem, mas passam por revisão da nossa equipe antes de ir ao ar.",
    exemplo: "Um balanço suspenso manteve a estrutura, mas a corda virou tubo sólido.",
  },
  {
    id: "luminaria",
    rotulo: "Luminária ou metal fino",
    descricao: "Hastes, cúpulas, fios aparentes",
    expectativa: "baixa",
    automatico: true,
    aviso:
      "Hastes muito finas podem sumir ou engrossar. Geramos para você avaliar, mas o resultado costuma exigir ajuste manual.",
  },
  {
    id: "trama_fina",
    rotulo: "Palhinha, rattan ou corda",
    descricao: "Tramas vazadas e fibras naturais",
    expectativa: "bloqueada",
    automatico: false,
    aviso:
      "Esta categoria não é atendida pelo processo automático. Tramas finas viram massa sólida na geração por IA — este produto precisa da nossa modelagem artesanal.",
    exemplo: "No nosso teste, uma cadeira de palhinha perdeu uma perna e a trama virou ruído.",
  },
  {
    id: "persiana",
    rotulo: "Persiana, cortina ou lâminas",
    descricao: "Geometria fina e repetitiva",
    expectativa: "bloqueada",
    automatico: false,
    aviso:
      "Lâminas finas e repetidas exigem precisão milimétrica que o processo automático não entrega. Produtos assim são feitos pela nossa equipe.",
  },
  {
    id: "outro",
    rotulo: "Outro tipo de produto",
    descricao: "Não sei classificar / é diferente",
    expectativa: "media",
    automatico: true,
    aviso: "Vamos gerar e medir automaticamente a fidelidade do resultado antes de te mostrar.",
  },
];

export const EXPECTATIVA_LABEL: Record<Expectativa, { texto: string; tom: string }> = {
  alta: { texto: "Alta fidelidade", tom: "verde" },
  media: { texto: "Boa, com revisão", tom: "ambar" },
  baixa: { texto: "Resultado incerto", tom: "ambar" },
  bloqueada: { texto: "Só no artesanal", tom: "vermelho" },
};

/** Corte de qualidade aprovado em 21/07/2026. */
export const CORTE_PUBLICA = 8;
export const CORTE_REVISAO = 6;

export function rotaPorNota(nota: number): "automatica" | "revisao" | "artesanal" {
  if (nota >= CORTE_PUBLICA) return "automatica";
  if (nota >= CORTE_REVISAO) return "revisao";
  return "artesanal";
}
