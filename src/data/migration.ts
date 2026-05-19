// Auto-gerado por migração Notion + Excel — 2026-05-17
// Single source of truth, substituindo Notion/Planner.
//
// Fontes:
//  - Notion: data source "Banco de Produtos" (collection://178bbcca-de67-4173-8b31-b8d76f91f81d)
//  - Excel: /Users/palhano/Downloads/Projetos - ATT.xlsx (Planner ATT)
//
// Convenções aplicadas:
//  - IDs sequenciais por cliente: pb_{clientId}_{n}, tk_{clientCode}_{n}, pub_{clientId}_{n}
//  - Status (SeedBlock):
//      Tech "Concluído"  + Link atual  -> "published"
//      Tech "Envio link revisado"      -> "published"  (link revisado já entregue)
//      Tech "Revisão programação"      -> "internal_review"
//      Tech "Texturização" / sem link  -> "in_modeling"
//      Tech "Aguardando aprovação"     -> "internal_review"
//      sem dados / criados recentemente sem link -> "in_modeling"
//  - SLA padrão para tickets ativos: created + 14 dias
//  - Atribuições (Excel "Atribuído a"):
//      Victor Salles    -> u3
//      Igor Augusto     -> u4
//      Lucas Liles      -> u5
//      Jessica Ribeiro  -> u6
//
// IMPORTANTE:
//  - WJ Luminárias (c11) já está migrado em Portal.tsx — não está incluído aqui.
//  - Para clientes sem produtos no Banco de Produtos (Cadeiras Rosa c13, Arctefacto c15)
//    foram criados apenas contratos vazios com totalBlocks: 0.

import type {
  SeedBlock,
  SeedContract,
  SeedPub,
  ProductionTicket,
} from "../components/Portal";

// ============================================================
// CONTRATOS (extras — já existem ct1 ct2 ct3 ct8 em Portal.tsx)
// ============================================================
export const MIGRATED_CONTRACTS: SeedContract[] = [
  { id: "ct4",  clientId: "c4",  title: "Contrato Minimal Design 2025 – Cabines",          totalBlocks: 30, usedBlocks: 12, startDate: "2025-07-15", active: true },
  { id: "ct5",  clientId: "c5",  title: "Contrato RS Design 2025 – Linha Nido/Casulo",     totalBlocks: 30, usedBlocks: 20, startDate: "2025-09-01", active: true },
  { id: "ct6",  clientId: "c6",  title: "Contrato Tidelli 2024 – Linha Outdoor",           totalBlocks: 30, usedBlocks: 20, startDate: "2024-10-01", active: true },
  { id: "ct7",  clientId: "c7",  title: "Contrato Hunter Douglas 2026 – Piloto Persianas", totalBlocks: 10, usedBlocks: 1,  startDate: "2026-04-01", active: true },
  // ct8 (WJ) já existe em Portal.tsx
  { id: "ct9",  clientId: "c8",  title: "Contrato Docol 2025 – Piloto Naiade",             totalBlocks: 10, usedBlocks: 1,  startDate: "2025-01-15", active: true },
  { id: "ct10", clientId: "c9",  title: "Contrato Pedro Franco 2024 – Linha Completa",     totalBlocks: 30, usedBlocks: 20, startDate: "2024-09-01", active: true },
  { id: "ct11", clientId: "c10", title: "Contrato Dexco 2026 – Linha Bicas e Misturadores",totalBlocks: 30, usedBlocks: 10, startDate: "2026-03-01", active: true },
  { id: "ct12", clientId: "c12", title: "Contrato Christie 2026 – Em definição",           totalBlocks: 10, usedBlocks: 0,  startDate: "2026-05-01", active: true },
  { id: "ct13", clientId: "c13", title: "Contrato Cadeiras Rosa 2026 – Em definição",      totalBlocks: 10, usedBlocks: 0,  startDate: "2026-05-01", active: true },
  { id: "ct14", clientId: "c14", title: "Contrato Jader Almeida 2024 – Linha Completa",    totalBlocks: 50, usedBlocks: 30, startDate: "2024-08-01", active: true },
  { id: "ct15", clientId: "c15", title: "Contrato Arctefacto 2026 – Em definição",         totalBlocks: 10, usedBlocks: 0,  startDate: "2026-05-01", active: true },
];

// ============================================================
// BLOCOS (produtos do Banco de Produtos do Notion)
// ============================================================
// Convenção de owner: padrão u3 (Victor) / backup u5 (Lucas) para móveis;
// owner u4 (Igor) ou u5 para itens em modelagem/programação puras.

export const MIGRATED_BLOCKS: SeedBlock[] = [
  // ============================================================
  // ESCAL (c1) — 25 produtos no Banco de Produtos (Notion)
  // Já existem pb1..pb6 em Portal.tsx (Banco Nub..Mesa Auxiliar Steel)
  // Adicionamos os demais como pb_c1_7..pb_c1_25
  // ============================================================
  { id: "pb_c1_7",  clientId: "c1", contractId: "ct1", n: 7,  sku: "2025-ESCAL-15-E01", csku: "POLTRONA-KALLA",       title: "Poltrona Kalla",          svc: "plus",     status: "in_modeling",     pri: "normal", owner: "u3", created: "2025-09-01" },
  { id: "pb_c1_8",  clientId: "c1", contractId: "ct1", n: 8,  sku: "2025-ESCAL-16-E02", csku: "POLTRONA-HUG",         title: "Poltrona Hug",            svc: "plus",     status: "in_programming",  pri: "normal", owner: "u5", created: "2025-09-15" },
  { id: "pb_c1_9",  clientId: "c1", contractId: "ct1", n: 9,  sku: "2025-ESCAL-25-E02", csku: "BANQUETA-LOAI",        title: "Banqueta Loai (E02)",     svc: "plus",     status: "internal_review", pri: "normal", owner: "u5", created: "2025-10-01" },
  { id: "pb_c1_10", clientId: "c1", contractId: "ct1", n: 10, sku: "2025-ESCAL-01-E02", csku: "APARADOR-NASCAR",      title: "Aparador Nascar",         svc: "plus",     status: "in_modeling",     pri: "normal", owner: "u3", created: "2025-09-15" },
  { id: "pb_c1_11", clientId: "c1", contractId: "ct1", n: 11, sku: "2025-ESCAL-36-E01", csku: "POLTRONA-MARGOT-E01",  title: "Poltrona Margot (E01)",   svc: "plus",     status: "in_programming",  pri: "high",   owner: "u3", created: "2025-08-01" },
  { id: "pb_c1_12", clientId: "c1", contractId: "ct1", n: 12, sku: "2025-ESCAL-24-E02", csku: "BANQUETA-HUG",         title: "Banqueta Hug",            svc: "plus",     status: "in_modeling",     pri: "normal", owner: "u4", created: "2025-10-15" },
  { id: "pb_c1_13", clientId: "c1", contractId: "ct1", n: 13, sku: "2025-ESCAL-06-E02", csku: "ESPELHO-HERON",        title: "Espelho Heron",           svc: "standard", status: "in_programming",  pri: "normal", owner: "u5", created: "2025-08-15" },
  { id: "pb_c1_14", clientId: "c1", contractId: "ct1", n: 14, sku: "2025-ESCAL-20-E01", csku: "CADEIRA-AYLA",         title: "Cadeira Ayla",            svc: "plus",     status: "internal_review", pri: "normal", owner: "u5", created: "2025-09-01" },
  { id: "pb_c1_15", clientId: "c1", contractId: "ct1", n: 15, sku: "2025-ESCAL-23-E02", csku: "BANQUETA-CLOE",        title: "Banqueta Cloe",           svc: "plus",     status: "in_modeling",     pri: "normal", owner: "u4", created: "2025-10-20" },
  { id: "pb_c1_16", clientId: "c1", contractId: "ct1", n: 16, sku: "2025-ESCAL-21-E02", csku: "CADEIRA-HUG",          title: "Cadeira Hug",             svc: "plus",     status: "in_modeling",     pri: "normal", owner: "u4", created: "2025-10-20" },
  { id: "pb_c1_17", clientId: "c1", contractId: "ct1", n: 17, sku: "2025-ESCAL-03-E02", csku: "BANCO-LESS",           title: "Banco Less (Escal)",      svc: "standard", status: "in_programming",  pri: "normal", owner: "u5", created: "2025-09-10" },
  { id: "pb_c1_18", clientId: "c1", contractId: "ct1", n: 18, sku: "2025-ESCAL-19-E02", csku: "CADEIRA-KLARA",        title: "Cadeira Klara",           svc: "plus",     status: "in_modeling",     pri: "normal", owner: "u4", created: "2025-10-25" },
  { id: "pb_c1_19", clientId: "c1", contractId: "ct1", n: 19, sku: "2025-ESCAL-18-E02", csku: "CADEIRA-CLOE",         title: "Cadeira Cloe",            svc: "plus",     status: "in_modeling",     pri: "normal", owner: "u4", created: "2025-10-25" },
  { id: "pb_c1_20", clientId: "c1", contractId: "ct1", n: 20, sku: "2025-ESCAL-04-E02", csku: "CADEIRA-OFFICE-SOUL",  title: "Cadeira Office Soul",     svc: "plus",     status: "in_programming",  pri: "normal", owner: "u5", created: "2025-09-25" },
  { id: "pb_c1_21", clientId: "c1", contractId: "ct1", n: 21, sku: "2025-ESCAL-12-E03", csku: "MESA-CENTRO-STONE",    title: "Mesa de Centro Stone",    svc: "standard", status: "in_modeling",     pri: "normal", owner: "u4", created: "2026-02-01" },
  { id: "pb_c1_22", clientId: "c1", contractId: "ct1", n: 22, sku: "2025-ESCAL-26-E03", csku: "CARRINHO-NASCAR",      title: "Carrinho Nascar",         svc: "standard", status: "in_modeling",     pri: "normal", owner: "u4", created: "2026-02-15" },
  { id: "pb_c1_23", clientId: "c1", contractId: "ct1", n: 23, sku: "2025-ESCAL-14-E03", csku: "MESA-CENTRO-LAGOS",    title: "Mesa de Centro Lagos",    svc: "standard", status: "in_modeling",     pri: "normal", owner: "u4", created: "2026-02-15" },
  { id: "pb_c1_24", clientId: "c1", contractId: "ct1", n: 24, sku: "2025-ESCAL-08-E03", csku: "MESA-AUX-GRACE",       title: "Mesa Auxiliar Grace",     svc: "standard", status: "in_modeling",     pri: "normal", owner: "u4", created: "2026-02-15" },
  { id: "pb_c1_25", clientId: "c1", contractId: "ct1", n: 25, sku: "2025-ESCAL-13-E03", csku: "MESA-CENTRO-LIVV",     title: "Mesa de Centro Livv",     svc: "standard", status: "in_modeling",     pri: "normal", owner: "u4", created: "2026-02-15" },
  { id: "pb_c1_26", clientId: "c1", contractId: "ct1", n: 26, sku: "2025-ESCAL-07-E03", csku: "MESA-AUX-MARY-E03",    title: "Mesa Auxiliar Mary (E03)",svc: "standard", status: "in_modeling",     pri: "normal", owner: "u4", created: "2026-01-15" },
  { id: "pb_c1_27", clientId: "c1", contractId: "ct1", n: 27, sku: "2025-ESCAL-27-E04", csku: "MESA-CABEC-NASCAR",    title: "Mesa Cabeceira Nascar",   svc: "standard", status: "in_modeling",     pri: "normal", owner: "u4", created: "2026-03-15" },
  { id: "pb_c1_28", clientId: "c1", contractId: "ct1", n: 28, sku: "2025-ESCAL-34-E04", csku: "ESTANTE-GRID",         title: "Estante Grid",            svc: "plus",     status: "in_modeling",     pri: "normal", owner: "u3", created: "2026-01-10" },
  { id: "pb_c1_29", clientId: "c1", contractId: "ct1", n: 29, sku: "2025-ESCAL-32-E02", csku: "PUFF-UMMA-E02",        title: "Puff Umma (E02)",         svc: "standard", status: "in_programming",  pri: "normal", owner: "u5", created: "2025-09-01" },
  { id: "pb_c1_30", clientId: "c1", contractId: "ct1", n: 30, sku: "2025-ESCAL-33-E02", csku: "PUFF-LUCK",            title: "Puff Luck",               svc: "standard", status: "in_modeling",     pri: "normal", owner: "u4", created: "2025-12-01" },
  { id: "pb_c1_31", clientId: "c1", contractId: "ct1", n: 31, sku: "2025-ESCAL-17-E03", csku: "POLTRONA-EMY",         title: "Poltrona Emy",            svc: "plus",     status: "in_modeling",     pri: "normal", owner: "u3", created: "2025-12-15" },

  // ============================================================
  // ESTÚDIO BOLA (c2) — ~50 produtos no Banco de Produtos
  // Já existem pb7..pb14 em Portal.tsx
  // ============================================================
  { id: "pb_c2_9",  clientId: "c2", contractId: "ct2", n: 9,  sku: "2024-EB-E02-34", csku: "BANCO-KORK",           title: "Banco Kork",             svc: "standard", status: "published",       pri: "normal", owner: "u4", backup: "u5", created: "2024-11-15", published: "2025-05-12" },
  { id: "pb_c2_10", clientId: "c2", contractId: "ct2", n: 10, sku: "2024-EB-E02-40", csku: "BANQUETA-VIKI",        title: "Banqueta Viki",          svc: "standard", status: "published",       pri: "normal", owner: "u4", backup: "u5", created: "2024-12-01", published: "2025-06-10" },
  { id: "pb_c2_11", clientId: "c2", contractId: "ct2", n: 11, sku: "2024-EB-E02-33", csku: "BANCO-CAVE",           title: "Banco Cave",             svc: "standard", status: "published",       pri: "normal", owner: "u4", backup: "u5", created: "2024-11-15", published: "2025-05-12" },
  { id: "pb_c2_12", clientId: "c2", contractId: "ct2", n: 12, sku: "2024-EB-E02-32", csku: "BANCO-CARRETEL",       title: "Banco Carretel",         svc: "standard", status: "published",       pri: "normal", owner: "u4", backup: "u5", created: "2024-11-15", published: "2025-05-12" },
  { id: "pb_c2_13", clientId: "c2", contractId: "ct2", n: 13, sku: "2024-EB-E02-30", csku: "BANCO-BACURI",         title: "Banco Bacuri",           svc: "standard", status: "published",       pri: "normal", owner: "u4", backup: "u5", created: "2024-11-15", published: "2025-04-30" },
  { id: "pb_c2_14", clientId: "c2", contractId: "ct2", n: 14, sku: "2024-EB-E02-37", csku: "BANCO-VIKI",           title: "Banco Viki",             svc: "standard", status: "published",       pri: "normal", owner: "u4", backup: "u5", created: "2024-12-01", published: "2025-06-10" },
  { id: "pb_c2_15", clientId: "c2", contractId: "ct2", n: 15, sku: "2024-EB-E02-38", csku: "BANQUETA-HELGA",       title: "Banqueta Helga",         svc: "standard", status: "published",       pri: "normal", owner: "u4", backup: "u5", created: "2024-12-01", published: "2025-06-15" },
  { id: "pb_c2_16", clientId: "c2", contractId: "ct2", n: 16, sku: "2024-EB-E02-39", csku: "BANQUETA-LUISA",       title: "Banqueta Luisa",         svc: "standard", status: "published",       pri: "normal", owner: "u4", backup: "u5", created: "2024-12-01", published: "2025-06-15" },
  { id: "pb_c2_17", clientId: "c2", contractId: "ct2", n: 17, sku: "2024-EB-E02-15", csku: "POLTRONA-ACACIA",      title: "Poltrona Acácia (E02)",  svc: "plus",     status: "published",       pri: "normal", owner: "u3", backup: "u5", created: "2024-08-15", published: "2025-04-02" },
  { id: "pb_c2_18", clientId: "c2", contractId: "ct2", n: 18, sku: "2024-EB-E02-21", csku: "POLTRONA-LALA-E02",    title: "Poltrona Lalá (E02)",    svc: "plus",     status: "published",       pri: "normal", owner: "u3", backup: "u5", created: "2024-10-01", published: "2025-05-07" },
  { id: "pb_c2_19", clientId: "c2", contractId: "ct2", n: 19, sku: "2024-EB-E02-22", csku: "POLTRONA-LESS",        title: "Poltrona Less",          svc: "plus",     status: "published",       pri: "normal", owner: "u3", backup: "u5", created: "2024-10-01", published: "2025-05-07" },
  { id: "pb_c2_20", clientId: "c2", contractId: "ct2", n: 20, sku: "2024-EB-E02-24", csku: "POLTRONA-LUISA",       title: "Poltrona Luisa",         svc: "plus",     status: "published",       pri: "normal", owner: "u3", backup: "u5", created: "2024-10-01", published: "2025-05-07" },
  { id: "pb_c2_21", clientId: "c2", contractId: "ct2", n: 21, sku: "2024-EB-E02-25", csku: "POLTRONA-MABELLE",     title: "Poltrona Mabelle",       svc: "plus",     status: "published",       pri: "normal", owner: "u3", backup: "u5", created: "2024-10-01", published: "2025-05-07" },
  { id: "pb_c2_22", clientId: "c2", contractId: "ct2", n: 22, sku: "2024-EB-E02-26", csku: "POLTRONA-MEXERICA",    title: "Poltrona Mexerica",      svc: "plus",     status: "published",       pri: "normal", owner: "u3", backup: "u5", created: "2024-10-15", published: "2025-05-20" },
  { id: "pb_c2_23", clientId: "c2", contractId: "ct2", n: 23, sku: "2024-EB-E02-28", csku: "CHAISE-SERENA",        title: "Chaise Serena",          svc: "plus",     status: "published",       pri: "normal", owner: "u3", backup: "u5", created: "2024-11-01", published: "2025-06-01" },
  { id: "pb_c2_24", clientId: "c2", contractId: "ct2", n: 24, sku: "2025-EB-E03-58",  csku: "CENTRO-AROS",          title: "Centro Aros",            svc: "plus",     status: "internal_review", pri: "normal", owner: "u3",              created: "2025-08-01" },
  { id: "pb_c2_25", clientId: "c2", contractId: "ct2", n: 25, sku: "2025-EB-E03-59",  csku: "CENTRO-CAVALETTA",    title: "Centro Cavaletta",       svc: "plus",     status: "in_programming",  pri: "normal", owner: "u5",              created: "2025-08-01" },
  { id: "pb_c2_26", clientId: "c2", contractId: "ct2", n: 26, sku: "2025-EB-E03-55",  csku: "CAMA-LESS",            title: "Cama Less",              svc: "ultra",    status: "in_programming",  pri: "high",   owner: "u5", backup: "u3", created: "2025-08-15" },
  { id: "pb_c2_27", clientId: "c2", contractId: "ct2", n: 27, sku: "2025-EB-E04-70",  csku: "JANTAR-CAVALETTA",    title: "Jantar Cavaletta",       svc: "plus",     status: "in_modeling",     pri: "normal", owner: "u4",              created: "2025-11-01" },
  { id: "pb_c2_28", clientId: "c2", contractId: "ct2", n: 28, sku: "2025-EB-E04-71",  csku: "JANTAR-CONCRETE",     title: "Jantar Concrete",        svc: "plus",     status: "in_modeling",     pri: "normal", owner: "u4",              created: "2025-11-01" },
  { id: "pb_c2_29", clientId: "c2", contractId: "ct2", n: 29, sku: "2025-EB-E04-73",  csku: "JANTAR-CONCRETE-G",   title: "Jantar Concrete Garoni", svc: "plus",     status: "in_modeling",     pri: "normal", owner: "u4",              created: "2025-11-01" },
  { id: "pb_c2_30", clientId: "c2", contractId: "ct2", n: 30, sku: "2025-EB-E04-74",  csku: "JANTAR-PALMA",         title: "Jantar Palma",           svc: "plus",     status: "in_modeling",     pri: "normal", owner: "u4",              created: "2025-11-15" },
  { id: "pb_c2_31", clientId: "c2", contractId: "ct2", n: 31, sku: "2025-EB-E04-75",  csku: "JANTAR-PILOTIS",       title: "Jantar Pilotis",         svc: "plus",     status: "in_modeling",     pri: "normal", owner: "u4",              created: "2025-11-15" },
  { id: "pb_c2_32", clientId: "c2", contractId: "ct2", n: 32, sku: "2025-EB-E04-77",  csku: "JANTAR-TRIZ-PEDRA",   title: "Jantar Triz Pedra",      svc: "plus",     status: "in_modeling",     pri: "normal", owner: "u4",              created: "2025-12-01" },
  { id: "pb_c2_33", clientId: "c2", contractId: "ct2", n: 33, sku: "2025-EB-E04-78",  csku: "LATERAL-ARDEA-E04",   title: "Lateral Ardea (E04)",    svc: "standard", status: "in_modeling",     pri: "normal", owner: "u4",              created: "2025-12-01" },
  { id: "pb_c2_34", clientId: "c2", contractId: "ct2", n: 34, sku: "2025-EB-E04-80",  csku: "LATERAL-BALLOON-G",   title: "Lateral Balloon Granilite", svc: "standard", status: "in_modeling", pri: "normal", owner: "u4",              created: "2026-01-10" },
  { id: "pb_c2_35", clientId: "c2", contractId: "ct2", n: 35, sku: "2025-EB-E04-81",  csku: "LATERAL-BARNEY",       title: "Lateral Barney",         svc: "standard", status: "in_modeling",     pri: "normal", owner: "u4",              created: "2026-01-10" },
  { id: "pb_c2_36", clientId: "c2", contractId: "ct2", n: 36, sku: "2025-EB-E04-84",  csku: "LATERAL-FIT",          title: "Lateral Fit",            svc: "standard", status: "in_modeling",     pri: "normal", owner: "u4",              created: "2026-01-10" },
  { id: "pb_c2_37", clientId: "c2", contractId: "ct2", n: 37, sku: "2025-EB-E04-85",  csku: "LATERAL-NINHO-ALLEN", title: "Lateral Ninho Allen",    svc: "standard", status: "in_modeling",     pri: "normal", owner: "u4",              created: "2026-01-10" },
  { id: "pb_c2_38", clientId: "c2", contractId: "ct2", n: 38, sku: "2025-EB-E04-62",  csku: "CENTRO-FIT",            title: "Centro Fit",             svc: "standard", status: "in_modeling",     pri: "normal", owner: "u4",              created: "2026-01-15" },
  { id: "pb_c2_39", clientId: "c2", contractId: "ct2", n: 39, sku: "2025-EB-E05-86",  csku: "LATERAL-SABIA",        title: "Lateral Sabia",          svc: "standard", status: "in_modeling",     pri: "normal", owner: "u4",              created: "2026-02-01" },
  { id: "pb_c2_40", clientId: "c2", contractId: "ct2", n: 40, sku: "2025-EB-E05-88",  csku: "APARADOR-PILOTIS",     title: "Aparador Pilotis",       svc: "plus",     status: "in_modeling",     pri: "normal", owner: "u3",              created: "2026-02-01" },
  { id: "pb_c2_41", clientId: "c2", contractId: "ct2", n: 41, sku: "2025-EB-E05-90",  csku: "BUFFET-FILLET",        title: "Buffet Fillet",          svc: "plus",     status: "in_modeling",     pri: "normal", owner: "u3",              created: "2026-02-01" },
  { id: "pb_c2_42", clientId: "c2", contractId: "ct2", n: 42, sku: "2025-EB-E05-91",  csku: "BUFFET-PILOTIS",       title: "Buffet Pilotis",         svc: "plus",     status: "in_modeling",     pri: "normal", owner: "u3",              created: "2026-02-01" },
  { id: "pb_c2_43", clientId: "c2", contractId: "ct2", n: 43, sku: "2025-EB-E05-99",  csku: "CADEIRA-HELO",         title: "Cadeira Helo",           svc: "plus",     status: "in_modeling",     pri: "normal", owner: "u4",              created: "2026-03-01" },
  { id: "pb_c2_44", clientId: "c2", contractId: "ct2", n: 44, sku: "2025-EB-E05-100", csku: "CADEIRA-ORLA",         title: "Cadeira Orla",           svc: "plus",     status: "in_modeling",     pri: "normal", owner: "u4",              created: "2026-03-01" },
  { id: "pb_c2_45", clientId: "c2", contractId: "ct2", n: 45, sku: "2025-EB-E05-106", csku: "ML-ARARIPE-PEDRA",     title: "Mesa Lateral Araripe Pedra", svc: "standard", status: "in_modeling", pri: "normal", owner: "u4",              created: "2026-04-01" },
  { id: "pb_c2_46", clientId: "c2", contractId: "ct2", n: 46, sku: "2025-EB-E05-107", csku: "ML-OLIVIA",             title: "Mesa Lateral Olivia",    svc: "standard", status: "in_modeling",     pri: "normal", owner: "u4",              created: "2026-04-01" },

  // ============================================================
  // WENTZ (c3) — 25+ produtos no Banco de Produtos
  // Já existem pb15, pb16 em Portal.tsx
  // ============================================================
  { id: "pb_c3_3",  clientId: "c3", contractId: "ct3", n: 3,  sku: "2025-WENTZ-10-E01", csku: "CADEIRA-CAPA-E01",  title: "Cadeira Capa (E01)",      svc: "plus",  status: "published",       pri: "normal", owner: "u3", backup: "u5", created: "2025-02-01", published: "2025-07-15" },
  { id: "pb_c3_4",  clientId: "c3", contractId: "ct3", n: 4,  sku: "2025-WENTZ-11-E01", csku: "POLTRONA-CAPA",     title: "Poltrona Capa",           svc: "plus",  status: "published",       pri: "normal", owner: "u3", backup: "u5", created: "2025-02-01", published: "2025-07-15" },
  { id: "pb_c3_5",  clientId: "c3", contractId: "ct3", n: 5,  sku: "2025-WENTZ-12-E01", csku: "SOFA-FITA",         title: "Sofá Fita",               svc: "ultra", status: "published",       pri: "normal", owner: "u3", backup: "u5", created: "2025-03-01", published: "2025-09-10" },
  { id: "pb_c3_6",  clientId: "c3", contractId: "ct3", n: 6,  sku: "2025-WENTZ-13-E01", csku: "POLTRONA-FITA",     title: "Poltrona Fita",           svc: "plus",  status: "published",       pri: "normal", owner: "u3", backup: "u5", created: "2025-03-01", published: "2025-09-10" },
  { id: "pb_c3_7",  clientId: "c3", contractId: "ct3", n: 7,  sku: "2025-WENTZ-14-E01", csku: "PUFE-FITA",         title: "Pufe Fita",               svc: "standard", status: "published",   pri: "normal", owner: "u4", backup: "u5", created: "2025-03-01", published: "2025-09-10" },
  { id: "pb_c3_8",  clientId: "c3", contractId: "ct3", n: 8,  sku: "2025-WENTZ-15-E01", csku: "CADEIRA-GRAVATA",   title: "Cadeira Gravatá 2.0",     svc: "plus",  status: "published",       pri: "normal", owner: "u3", backup: "u5", created: "2025-03-15", published: "2025-09-25" },
  { id: "pb_c3_9",  clientId: "c3", contractId: "ct3", n: 9,  sku: "2025-WENTZ-01-E01", csku: "CAMA-BAIXA",        title: "Cama Baixa",              svc: "ultra", status: "in_programming",  pri: "high",   owner: "u5", backup: "u3", created: "2025-05-01" },
  { id: "pb_c3_10", clientId: "c3", contractId: "ct3", n: 10, sku: "2025-WENTZ-05-E01", csku: "PUFE-BAIXO",        title: "Pufe Baixo",              svc: "standard", status: "in_programming", pri: "normal", owner: "u5",          created: "2025-05-01" },
  { id: "pb_c3_11", clientId: "c3", contractId: "ct3", n: 11, sku: "2025-WENTZ-19-E02", csku: "MESA-CENTRO-TABUA-01", title: "Mesa Centro Tábua 01", svc: "plus", status: "in_modeling",      pri: "normal", owner: "u4",              created: "2025-11-01" },
  { id: "pb_c3_12", clientId: "c3", contractId: "ct3", n: 12, sku: "2025-WENTZ-20-E02", csku: "MESA-CENTRO-TABUA-02", title: "Mesa Centro Tábua 02", svc: "plus", status: "in_modeling",      pri: "normal", owner: "u4",              created: "2025-11-01" },
  { id: "pb_c3_13", clientId: "c3", contractId: "ct3", n: 13, sku: "2025-WENTZ-21-E02", csku: "MESA-LATERAL-TABUA",title: "Mesa Lateral Tábua",      svc: "standard", status: "in_modeling",  pri: "normal", owner: "u4",              created: "2025-11-01" },
  { id: "pb_c3_14", clientId: "c3", contractId: "ct3", n: 14, sku: "2025-WENTZ-22-E02", csku: "BANCO-TABUA",       title: "Banco Tábua",             svc: "standard", status: "in_modeling",  pri: "normal", owner: "u4",              created: "2025-11-01" },
  { id: "pb_c3_15", clientId: "c3", contractId: "ct3", n: 15, sku: "2025-WENTZ-23-E02", csku: "MESA-JANTAR-VOLTA", title: "Mesa Jantar Volta",       svc: "plus",  status: "in_modeling",     pri: "normal", owner: "u4",              created: "2025-11-15" },
  { id: "pb_c3_16", clientId: "c3", contractId: "ct3", n: 16, sku: "2025-WENTZ-24-E02", csku: "MJ-RETANG-VOLTA",   title: "Mesa Jantar Retangular Volta", svc: "plus", status: "in_modeling", pri: "normal", owner: "u4",            created: "2025-11-15" },
  { id: "pb_c3_17", clientId: "c3", contractId: "ct3", n: 17, sku: "2025-WENTZ-25-E02", csku: "MESA-CHA-VOLTA",    title: "Mesa Chá Volta",          svc: "standard", status: "in_modeling",  pri: "normal", owner: "u4",              created: "2025-11-15" },
  { id: "pb_c3_18", clientId: "c3", contractId: "ct3", n: 18, sku: "2025-WENTZ-26-E02", csku: "MESA-CENTRO-VOLTA", title: "Mesa Centro Volta",       svc: "plus",  status: "in_modeling",     pri: "normal", owner: "u4",              created: "2025-11-15" },
  { id: "pb_c3_19", clientId: "c3", contractId: "ct3", n: 19, sku: "2025-WENTZ-27-E02", csku: "MESA-LATERAL-VOLTA",title: "Mesa Lateral Volta",      svc: "standard", status: "in_modeling",  pri: "normal", owner: "u4",              created: "2025-11-15" },
  { id: "pb_c3_20", clientId: "c3", contractId: "ct3", n: 20, sku: "2025-WENTZ-28-E02", csku: "CADEIRA-TELA",      title: "Cadeira Tela",            svc: "plus",  status: "in_modeling",     pri: "normal", owner: "u4",              created: "2025-12-01" },
  { id: "pb_c3_21", clientId: "c3", contractId: "ct3", n: 21, sku: "2025-WENTZ-33-E02", csku: "MJ-ENCAIXE",        title: "Mesa de Jantar Encaixe",  svc: "plus",  status: "in_modeling",     pri: "normal", owner: "u4",              created: "2026-02-15" },
  { id: "pb_c3_22", clientId: "c3", contractId: "ct3", n: 22, sku: "2025-WENTZ-34-E02", csku: "MESA-APOIO-ENCAIXE",title: "Mesa de Apoio Encaixe",   svc: "standard", status: "in_modeling",  pri: "normal", owner: "u4",              created: "2026-02-15" },
  { id: "pb_c3_23", clientId: "c3", contractId: "ct3", n: 23, sku: "2025-WENTZ-35-E02", csku: "TOTEM-ENCAIXE",     title: "Totem Encaixe",           svc: "standard", status: "in_modeling",  pri: "normal", owner: "u4",              created: "2026-02-15" },
  { id: "pb_c3_24", clientId: "c3", contractId: "ct3", n: 24, sku: "2025-WENTZ-36-E02", csku: "ARMARIO-ENCAIXE",   title: "Armário Encaixe",         svc: "plus",  status: "in_modeling",     pri: "normal", owner: "u3",              created: "2026-02-15" },
  { id: "pb_c3_25", clientId: "c3", contractId: "ct3", n: 25, sku: "2025-WENTZ-37-E02", csku: "APARADOR-ENCAIXE",  title: "Aparador Encaixe",        svc: "plus",  status: "in_modeling",     pri: "normal", owner: "u3",              created: "2026-02-15" },
  { id: "pb_c3_26", clientId: "c3", contractId: "ct3", n: 26, sku: "2025-WENTZ-38-E02", csku: "CONSOLE-ENCAIXE",   title: "Console Encaixe",         svc: "plus",  status: "in_modeling",     pri: "normal", owner: "u3",              created: "2026-02-15" },

  // ============================================================
  // MINIMAL DESIGN (c4) — 12+ produtos. Já há pb17..pb19 em Portal.tsx
  // ============================================================
  { id: "pb_c4_4",  clientId: "c4", contractId: "ct4", n: 4,  sku: "2025-MINIMAL-03-E01", csku: "CABINE-PLAY-M",          title: "Cabine Play Média",            svc: "standard", status: "in_programming",  pri: "normal", owner: "u5", created: "2025-08-15" },
  { id: "pb_c4_5",  clientId: "c4", contractId: "ct4", n: 5,  sku: "2025-MINIMAL-04-E01", csku: "CABINE-PLAY-G",          title: "Cabine Play Grande",           svc: "standard", status: "in_programming",  pri: "normal", owner: "u5", created: "2025-08-15" },
  { id: "pb_c4_6",  clientId: "c4", contractId: "ct4", n: 6,  sku: "2025-MINIMAL-06-E02", csku: "CABINE-LEO-XP",          title: "Cabine Leo 3.8 Extra Pequena", svc: "standard", status: "in_modeling",     pri: "normal", owner: "u4", created: "2025-09-15" },
  { id: "pb_c4_7",  clientId: "c4", contractId: "ct4", n: 7,  sku: "2025-MINIMAL-07-E02", csku: "CABINE-LEO-P",           title: "Cabine Leo 3.8 Pequena",       svc: "standard", status: "in_modeling",     pri: "normal", owner: "u4", created: "2025-09-15" },
  { id: "pb_c4_8",  clientId: "c4", contractId: "ct4", n: 8,  sku: "2025-MINIMAL-08-E02", csku: "CABINE-LEO-M",           title: "Cabine Leo 3.8 Média",         svc: "standard", status: "in_modeling",     pri: "normal", owner: "u4", created: "2025-09-15" },
  { id: "pb_c4_9",  clientId: "c4", contractId: "ct4", n: 9,  sku: "2025-MINIMAL-09-E02", csku: "CABINE-LEO-G",           title: "Cabine Leo 3.8 Grande",        svc: "standard", status: "in_modeling",     pri: "normal", owner: "u4", created: "2025-09-15" },
  { id: "pb_c4_10", clientId: "c4", contractId: "ct4", n: 10, sku: "2025-MINIMAL-10-E01", csku: "CABINE-BINE-XP",         title: "Cabine Modelo Bine XP",        svc: "standard", status: "in_modeling",     pri: "normal", owner: "u4", created: "2025-10-01" },
  { id: "pb_c4_11", clientId: "c4", contractId: "ct4", n: 11, sku: "2025-MINIMAL-11-E01", csku: "CABINE-BINE-P",          title: "Cabine Modelo Bine Pequena",   svc: "standard", status: "in_modeling",     pri: "normal", owner: "u4", created: "2025-10-01" },
  { id: "pb_c4_12", clientId: "c4", contractId: "ct4", n: 12, sku: "2025-MINIMAL-12-E01", csku: "CABINE-BINE-INT",        title: "Cabine Modelo Bine Intermediária", svc: "standard", status: "in_modeling", pri: "normal", owner: "u4", created: "2025-10-01" },
  { id: "pb_c4_13", clientId: "c4", contractId: "ct4", n: 13, sku: "2025-MINIMAL-13-E01", csku: "CABINE-BINE-M",          title: "Cabine Modelo Bine Média",     svc: "standard", status: "in_modeling",     pri: "normal", owner: "u4", created: "2025-10-01" },
  { id: "pb_c4_14", clientId: "c4", contractId: "ct4", n: 14, sku: "2025-MINIMAL-14-E01", csku: "CABINE-BINE-G",          title: "Cabine Modelo Bine Grande",    svc: "standard", status: "in_modeling",     pri: "normal", owner: "u4", created: "2025-10-01" },

  // ============================================================
  // RS DESIGN (c5) — 20 produtos
  // ============================================================
  { id: "pb_c5_1",  clientId: "c5", contractId: "ct5", n: 1,  sku: "2025-RS-DESIGN-01-E01", csku: "POLTRONA-CASULO-NIDO", title: "Poltrona Casulo Nido",      svc: "plus",     status: "in_modeling",    pri: "normal", owner: "u3", created: "2025-09-15" },
  { id: "pb_c5_2",  clientId: "c5", contractId: "ct5", n: 2,  sku: "2025-RS-DESIGN-02-E01", csku: "CADEIRA-AXIS",          title: "Cadeira Axis",              svc: "plus",     status: "in_modeling",    pri: "normal", owner: "u4", created: "2025-09-15" },
  { id: "pb_c5_3",  clientId: "c5", contractId: "ct5", n: 3,  sku: "2025-RS-DESIGN-03-E01", csku: "SOFA-CASULO-NIDO",      title: "Sofá Casulo Nido",          svc: "ultra",    status: "in_modeling",    pri: "normal", owner: "u3", created: "2025-09-15" },
  { id: "pb_c5_4",  clientId: "c5", contractId: "ct5", n: 4,  sku: "2025-RS-DESIGN-04-E01", csku: "PUFE-VERSA-G",          title: "Pufe Versa Baixo Grand",    svc: "standard", status: "in_modeling",    pri: "normal", owner: "u4", created: "2025-09-15" },
  { id: "pb_c5_5",  clientId: "c5", contractId: "ct5", n: 5,  sku: "2025-RS-DESIGN-05-E01", csku: "CABINE-NIDO-IND",       title: "Cabine Nido Casulo Individual", svc: "plus", status: "in_modeling",    pri: "normal", owner: "u3", created: "2025-10-01" },
  { id: "pb_c5_6",  clientId: "c5", contractId: "ct5", n: 6,  sku: "2025-RS-DESIGN-06-E01", csku: "SOFA-NIDO-ALTO-IND",    title: "Sofá Nido Alto Individual", svc: "ultra",    status: "in_modeling",    pri: "normal", owner: "u3", created: "2025-10-01" },
  { id: "pb_c5_7",  clientId: "c5", contractId: "ct5", n: 7,  sku: "2025-RS-DESIGN-07-E01", csku: "SOFA-NIDO-ALTO-DUO",    title: "Sofá Nido Alto Duo",        svc: "ultra",    status: "in_modeling",    pri: "normal", owner: "u3", created: "2025-10-01" },
  { id: "pb_c5_8",  clientId: "c5", contractId: "ct5", n: 8,  sku: "2025-RS-DESIGN-08-E01", csku: "POLTRONA-NIDO",         title: "Poltrona Nido",             svc: "plus",     status: "in_modeling",    pri: "normal", owner: "u4", created: "2025-10-01" },
  { id: "pb_c5_9",  clientId: "c5", contractId: "ct5", n: 9,  sku: "2025-RS-DESIGN-09-E01", csku: "SOFA-NIDO-DUO",         title: "Sofá Nido Duo",             svc: "ultra",    status: "in_modeling",    pri: "normal", owner: "u3", created: "2025-10-01" },
  { id: "pb_c5_10", clientId: "c5", contractId: "ct5", n: 10, sku: "2025-RS-DESIGN-10-E01", csku: "ARQUIB-ARIS",            title: "Arquibancada Aris",         svc: "plus",     status: "in_modeling",    pri: "normal", owner: "u3", created: "2025-10-15" },
  { id: "pb_c5_11", clientId: "c5", contractId: "ct5", n: 11, sku: "2025-RS-DESIGN-11-E01", csku: "SOFA-TRAMA",             title: "Sofá Trama",                svc: "ultra",    status: "in_modeling",    pri: "normal", owner: "u3", created: "2025-10-15" },
  { id: "pb_c5_12", clientId: "c5", contractId: "ct5", n: 12, sku: "2025-RS-DESIGN-12-E01", csku: "SOFA-MY-SPACE",          title: "Sofá My Space",             svc: "ultra",    status: "in_modeling",    pri: "normal", owner: "u3", created: "2025-10-15" },
  { id: "pb_c5_13", clientId: "c5", contractId: "ct5", n: 13, sku: "2025-RS-DESIGN-13-E0",  csku: "RS-13",                  title: "RS Design 13 (a definir)",  svc: "standard", status: "in_modeling",    pri: "low",    owner: "u4", created: "2025-11-15" },
  { id: "pb_c5_14", clientId: "c5", contractId: "ct5", n: 14, sku: "2025-RS-DESIGN-14-E0",  csku: "RS-14",                  title: "RS Design 14 (a definir)",  svc: "standard", status: "in_modeling",    pri: "low",    owner: "u4", created: "2025-11-15" },
  { id: "pb_c5_15", clientId: "c5", contractId: "ct5", n: 15, sku: "2025-RS-DESIGN-15-E0",  csku: "RS-15",                  title: "RS Design 15 (a definir)",  svc: "standard", status: "in_modeling",    pri: "low",    owner: "u4", created: "2025-11-15" },
  { id: "pb_c5_16", clientId: "c5", contractId: "ct5", n: 16, sku: "2025-RS-DESIGN-16-E0",  csku: "RS-16",                  title: "RS Design 16 (a definir)",  svc: "standard", status: "in_modeling",    pri: "low",    owner: "u4", created: "2025-11-15" },
  { id: "pb_c5_17", clientId: "c5", contractId: "ct5", n: 17, sku: "2025-RS-DESIGN-17-E0",  csku: "RS-17",                  title: "RS Design 17 (a definir)",  svc: "standard", status: "in_modeling",    pri: "low",    owner: "u4", created: "2025-11-15" },
  { id: "pb_c5_18", clientId: "c5", contractId: "ct5", n: 18, sku: "2025-RS-DESIGN-18-E0",  csku: "RS-18",                  title: "RS Design 18 (a definir)",  svc: "standard", status: "in_modeling",    pri: "low",    owner: "u4", created: "2025-11-15" },
  { id: "pb_c5_19", clientId: "c5", contractId: "ct5", n: 19, sku: "2025-RS-DESIGN-19-E0",  csku: "RS-19",                  title: "RS Design 19 (a definir)",  svc: "standard", status: "in_modeling",    pri: "low",    owner: "u4", created: "2025-11-15" },
  { id: "pb_c5_20", clientId: "c5", contractId: "ct5", n: 20, sku: "2025-RS-DESIGN-20-E0",  csku: "RS-20",                  title: "RS Design 20 (a definir)",  svc: "standard", status: "in_modeling",    pri: "low",    owner: "u4", created: "2025-11-15" },

  // ============================================================
  // TIDELLI (c6) — 20 produtos, todos finalizados/em revisão (Tech "Envio link revisado")
  // Drop foi confirmado com Link atual → published
  // ============================================================
  { id: "pb_c6_1",  clientId: "c6", contractId: "ct6", n: 1,  sku: "2024-TIDELLI-01-E1", csku: "MESA-MONSTERA",        title: "Mesa Monstera",            svc: "plus",  status: "published",       pri: "normal", owner: "u3", backup: "u5", created: "2024-10-01", published: "2025-12-01" },
  { id: "pb_c6_2",  clientId: "c6", contractId: "ct6", n: 2,  sku: "2024-TIDELLI-02-E1", csku: "MDC-FOLHA-BANANEIRA",  title: "MDC Folha Bananeira",      svc: "plus",  status: "published",       pri: "normal", owner: "u3", backup: "u5", created: "2024-10-01", published: "2025-12-01" },
  { id: "pb_c6_3",  clientId: "c6", contractId: "ct6", n: 3,  sku: "2024-TIDELLI-03-E1", csku: "CADEIRA-CB-CARAIVA",   title: "Cadeira C/B Caraiva",      svc: "plus",  status: "published",       pri: "normal", owner: "u3", backup: "u5", created: "2024-10-15", published: "2025-12-15" },
  { id: "pb_c6_4",  clientId: "c6", contractId: "ct6", n: 4,  sku: "2024-TIDELLI-04-E1", csku: "POLTRONA-CARAIVA",     title: "Poltrona Caraiva",         svc: "plus",  status: "published",       pri: "normal", owner: "u3", backup: "u5", created: "2024-10-15", published: "2025-12-15" },
  { id: "pb_c6_5",  clientId: "c6", contractId: "ct6", n: 5,  sku: "2024-TIDELLI-05-E1", csku: "POLTRONA-REC-CARAIVA", title: "Poltrona Rec Caraiva",     svc: "plus",  status: "published",       pri: "normal", owner: "u3", backup: "u5", created: "2024-10-15", published: "2025-12-15" },
  { id: "pb_c6_6",  clientId: "c6", contractId: "ct6", n: 6,  sku: "2024-TIDELLI-06-E1", csku: "ESPREG-CARAIVA",       title: "Espreguiçadeira Caraiva",  svc: "plus",  status: "published",       pri: "normal", owner: "u3", backup: "u5", created: "2024-11-01", published: "2026-01-15" },
  { id: "pb_c6_7",  clientId: "c6", contractId: "ct6", n: 7,  sku: "2024-TIDELLI-07-E1", csku: "BANCO-CARAIVA",        title: "Banco Caraiva",            svc: "standard", status: "published",    pri: "normal", owner: "u4", backup: "u5", created: "2024-11-01", published: "2026-01-15" },
  { id: "pb_c6_8",  clientId: "c6", contractId: "ct6", n: 8,  sku: "2024-TIDELLI-08-E1", csku: "DROP",                 title: "Drop",                     svc: "plus",  status: "published",       pri: "normal", owner: "u3", backup: "u5", created: "2024-11-15", published: "2026-01-22" },
  { id: "pb_c6_9",  clientId: "c6", contractId: "ct6", n: 9,  sku: "2024-TIDELLI-09-E2", csku: "CADEIRA-PENTAGRAMMA",  title: "Cadeira Pentagramma",      svc: "plus",  status: "published",       pri: "normal", owner: "u3", backup: "u5", created: "2024-12-01", published: "2026-01-30" },
  { id: "pb_c6_10", clientId: "c6", contractId: "ct6", n: 10, sku: "2024-TIDELLI-10-E1", csku: "SOFA-SAHARA",          title: "Sofá Sahara",              svc: "ultra", status: "published",       pri: "normal", owner: "u3", backup: "u5", created: "2024-12-01", published: "2026-02-05" },
  { id: "pb_c6_11", clientId: "c6", contractId: "ct6", n: 11, sku: "2024-TIDELLI-11-E1", csku: "CADEIRA-SHELL",        title: "Cadeira Shell",            svc: "plus",  status: "published",       pri: "normal", owner: "u3", backup: "u5", created: "2024-12-15", published: "2026-02-10" },
  { id: "pb_c6_12", clientId: "c6", contractId: "ct6", n: 12, sku: "2024-TIDELLI-12-E1", csku: "POLTRONA-SHELL",       title: "Poltrona Shell",           svc: "plus",  status: "published",       pri: "normal", owner: "u3", backup: "u5", created: "2024-12-15", published: "2026-02-10" },
  { id: "pb_c6_13", clientId: "c6", contractId: "ct6", n: 13, sku: "2024-TIDELLI-13-E1", csku: "NAMORADEIRA-SHELL",    title: "Namoradeira Shell",        svc: "plus",  status: "published",       pri: "normal", owner: "u3", backup: "u5", created: "2024-12-15", published: "2026-02-10" },
  { id: "pb_c6_14", clientId: "c6", contractId: "ct6", n: 14, sku: "2024-TIDELLI-14-E2", csku: "APOIO-MONTE-CARLO",    title: "Apoio de Quadra Monte Carlo", svc: "standard", status: "published", pri: "normal", owner: "u4", backup: "u5", created: "2025-01-01", published: "2026-02-20" },
  { id: "pb_c6_15", clientId: "c6", contractId: "ct6", n: 15, sku: "2024-TIDELLI-15-E2", csku: "BANCO-MONTE-CARLO",    title: "Banco c/ Encosto Monte Carlo", svc: "standard", status: "published", pri: "normal", owner: "u4", backup: "u5", created: "2025-01-01", published: "2026-02-20" },
  { id: "pb_c6_16", clientId: "c6", contractId: "ct6", n: 16, sku: "2024-TIDELLI-16-E2", csku: "MDJ-ORGANIKA",         title: "Mesa de Jantar Organika",  svc: "plus",  status: "published",       pri: "normal", owner: "u3", backup: "u5", created: "2025-01-15", published: "2026-02-25" },
  { id: "pb_c6_17", clientId: "c6", contractId: "ct6", n: 17, sku: "2024-TIDELLI-17-E1", csku: "POLTRONA-TRAP-SOFT",   title: "Poltrona Trap Soft",       svc: "plus",  status: "published",       pri: "normal", owner: "u3", backup: "u5", created: "2025-01-15", published: "2026-03-01" },
  { id: "pb_c6_18", clientId: "c6", contractId: "ct6", n: 18, sku: "2024-TIDELLI-18-E2", csku: "PUFF-TRAP-SOFT",       title: "Puff Trap Soft",           svc: "standard", status: "published",    pri: "normal", owner: "u4", backup: "u5", created: "2025-01-15", published: "2026-03-01" },
  { id: "pb_c6_19", clientId: "c6", contractId: "ct6", n: 19, sku: "2024-TIDELLI-19-E1", csku: "ESPREG-PADANG",        title: "Espreguiçadeira Padang",   svc: "plus",  status: "published",       pri: "normal", owner: "u3", backup: "u5", created: "2025-02-01", published: "2026-03-05" },
  { id: "pb_c6_20", clientId: "c6", contractId: "ct6", n: 20, sku: "2024-TIDELLI-20-E2", csku: "OMBRELONE-CARAIVA",    title: "Ombrelone Hexagonal Caraiva", svc: "plus", status: "published",     pri: "normal", owner: "u3", backup: "u5", created: "2025-02-01", published: "2026-03-05" },

  // ============================================================
  // HUNTER DOUGLAS (c7) — 1 piloto
  // ============================================================
  { id: "pb_c7_1",  clientId: "c7", contractId: "ct7", n: 1, sku: "2026-HUNTER-01", csku: "PERSIANA-COUNTRY-WOODS", title: "Persiana Country Woods", svc: "plus", status: "internal_review", pri: "high", owner: "u3", backup: "u5", created: "2026-04-10" },

  // ============================================================
  // DOCOL (c8) — 1 piloto
  // ============================================================
  { id: "pb_c8_1",  clientId: "c8", contractId: "ct9", n: 1, sku: "2025-DOCOL-PILOTO-00", csku: "TORNEIRA-NAIADE", title: "Torneira Naiade", svc: "plus", status: "published", pri: "normal", owner: "u3", backup: "u5", created: "2025-01-20", published: "2025-02-25" },

  // ============================================================
  // PEDRO FRANCO (c9) — 20 produtos
  // ============================================================
  { id: "pb_c9_1",  clientId: "c9", contractId: "ct10", n: 1,  sku: "2024-PF-01-E01", csku: "CADEIRA-ICONE",       title: "Cadeira Icone",         svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-09-15", published: "2025-08-10" },
  { id: "pb_c9_2",  clientId: "c9", contractId: "ct10", n: 2,  sku: "2024-PF-02-E01", csku: "POLTRONA-ANCESTRAL",  title: "Poltrona Ancestral",    svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-09-15", published: "2025-08-10" },
  { id: "pb_c9_3",  clientId: "c9", contractId: "ct10", n: 3,  sku: "2024-PF-03-E01", csku: "MESA-DALI",            title: "Mesa Dali",             svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-09-15", published: "2025-08-10" },
  { id: "pb_c9_4",  clientId: "c9", contractId: "ct10", n: 4,  sku: "2024-PF-04-E01", csku: "ML-RUPESTRE",          title: "Mesa Lateral Rupestre", svc: "standard", status: "published",   pri: "normal", owner: "u4", backup: "u5", created: "2024-10-01", published: "2025-08-20" },
  { id: "pb_c9_5",  clientId: "c9", contractId: "ct10", n: 5,  sku: "2024-PF-05-E02", csku: "POLTRONA-ANTROP",     title: "Poltrona Antrop",       svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-10-15", published: "2025-09-01" },
  { id: "pb_c9_6",  clientId: "c9", contractId: "ct10", n: 6,  sku: "2024-PF-06-E02", csku: "SOFA-ANTROP",          title: "Sofá Antrop",           svc: "ultra", status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-10-15", published: "2025-09-01" },
  { id: "pb_c9_7",  clientId: "c9", contractId: "ct10", n: 7,  sku: "2024-PF-07-E02", csku: "APARADOR-UNDERC",      title: "Aparador Underc",       svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-10-15", published: "2025-09-15" },
  { id: "pb_c9_8",  clientId: "c9", contractId: "ct10", n: 8,  sku: "2024-PF-08-E01", csku: "CADEIRA-ESQUELETO",   title: "Cadeira Esqueleto",     svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-11-01", published: "2025-09-25" },
  { id: "pb_c9_9",  clientId: "c9", contractId: "ct10", n: 9,  sku: "2024-PF-09-E01", csku: "BANQUETA-ESQUELETO",  title: "Banqueta Esqueleto",    svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-11-01", published: "2025-09-25" },
  { id: "pb_c9_10", clientId: "c9", contractId: "ct10", n: 10, sku: "2024-PF-10-E01", csku: "BANCO-ESQUELETO",     title: "Banco Esqueleto",       svc: "standard", status: "published",   pri: "normal", owner: "u4", backup: "u5", created: "2024-11-01", published: "2025-09-25" },
  { id: "pb_c9_11", clientId: "c9", contractId: "ct10", n: 11, sku: "2024-PF-11-E01", csku: "MESA-ESQUELETO",      title: "Mesa Esqueleto",        svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-11-15", published: "2025-10-10" },
  { id: "pb_c9_12", clientId: "c9", contractId: "ct10", n: 12, sku: "2024-PF-12-E01", csku: "APARADOR-ESQUELETO",  title: "Aparador Esqueleto",    svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-11-15", published: "2025-10-10" },
  { id: "pb_c9_13", clientId: "c9", contractId: "ct10", n: 13, sku: "2024-PF-13-E02", csku: "POLTRONA-KAOS",        title: "Poltrona Kaos",         svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-12-01", published: "2025-10-25" },
  { id: "pb_c9_14", clientId: "c9", contractId: "ct10", n: 14, sku: "2024-PF-14-E02", csku: "APARADOR-KINTSUGI",    title: "Aparador Kintsugi",     svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-12-01", published: "2025-11-05" },
  { id: "pb_c9_15", clientId: "c9", contractId: "ct10", n: 15, sku: "2024-PF-15-E02", csku: "MESA-KINTSUGI",        title: "Mesa Kintsugi",         svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-12-01", published: "2025-11-05" },
  { id: "pb_c9_16", clientId: "c9", contractId: "ct10", n: 16, sku: "2024-PF-16-E02", csku: "APARADOR-RENASCENCA", title: "Aparador Renascenca",   svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-12-15", published: "2025-11-15" },
  { id: "pb_c9_17", clientId: "c9", contractId: "ct10", n: 17, sku: "2024-PF-17-E02", csku: "CADEIRA-FLA",          title: "Cadeira Fla",           svc: "plus",  status: "internal_review",pri: "normal", owner: "u5", backup: "u3", created: "2025-01-15" },
  { id: "pb_c9_18", clientId: "c9", contractId: "ct10", n: 18, sku: "2024-PF-18-E02", csku: "POLTRONA-SUPERNOVA",   title: "Poltrona Supernova",    svc: "plus",  status: "in_programming", pri: "normal", owner: "u5", backup: "u3", created: "2025-01-15" },
  { id: "pb_c9_19", clientId: "c9", contractId: "ct10", n: 19, sku: "2024-PF-19-E02", csku: "POLTRONA-UNDERC",      title: "Poltrona Underc",       svc: "plus",  status: "in_programming", pri: "normal", owner: "u5", backup: "u3", created: "2025-01-15" },
  { id: "pb_c9_20", clientId: "c9", contractId: "ct10", n: 20, sku: "2024-PF-20-E02", csku: "SOFA-UNDERC",          title: "Sofá Underc",           svc: "ultra", status: "in_programming", pri: "high",   owner: "u5", backup: "u3", created: "2025-02-01" },

  // ============================================================
  // DEXCO (c10) — 10 produtos novos (E01). Já existe pb20 (Produto Validação) em Portal.tsx
  // ============================================================
  { id: "pb_c10_2",  clientId: "c10", contractId: "ct11", n: 2,  sku: "2026-DEXCO-01-E01", csku: "BICA-MESA-P-WAVE",     title: "Bica de Mesa P Wave",                 svc: "standard", status: "in_modeling", pri: "normal", owner: "u4", created: "2026-03-15" },
  { id: "pb_c10_3",  clientId: "c10", contractId: "ct11", n: 3,  sku: "2026-DEXCO-02-E01", csku: "BICA-MESA-M-WAVE",     title: "Bica de Mesa M Wave",                 svc: "standard", status: "in_modeling", pri: "normal", owner: "u4", created: "2026-03-15" },
  { id: "pb_c10_4",  clientId: "c10", contractId: "ct11", n: 4,  sku: "2026-DEXCO-03-E01", csku: "BICA-MESA-P-MEMPHIS",  title: "Bica de Mesa P Memphis",              svc: "standard", status: "in_modeling", pri: "normal", owner: "u4", created: "2026-03-20" },
  { id: "pb_c10_5",  clientId: "c10", contractId: "ct11", n: 5,  sku: "2026-DEXCO-04-E01", csku: "BICA-MESA-M-MEMPHIS",  title: "Bica de Mesa M Memphis",              svc: "standard", status: "in_modeling", pri: "normal", owner: "u4", created: "2026-03-20" },
  { id: "pb_c10_6",  clientId: "c10", contractId: "ct11", n: 6,  sku: "2026-DEXCO-05-E01", csku: "BICA-MESA-P-REDONDA",  title: "Bica de Mesa P Redonda",              svc: "standard", status: "in_modeling", pri: "normal", owner: "u4", created: "2026-04-01" },
  { id: "pb_c10_7",  clientId: "c10", contractId: "ct11", n: 7,  sku: "2026-DEXCO-06-E01", csku: "BICA-MESA-M-REDONDA",  title: "Bica de Mesa M Redonda",              svc: "standard", status: "in_modeling", pri: "normal", owner: "u4", created: "2026-04-01" },
  { id: "pb_c10_8",  clientId: "c10", contractId: "ct11", n: 8,  sku: "2026-DEXCO-07-E01", csku: "BICA-MESA-G-REDONDA",  title: "Bica de Mesa G Redonda",              svc: "standard", status: "in_modeling", pri: "normal", owner: "u4", created: "2026-04-01" },
  { id: "pb_c10_9",  clientId: "c10", contractId: "ct11", n: 9,  sku: "2026-DEXCO-08-E01", csku: "MMT-PISO-QUADRADO",    title: "Misturador Monocomando Piso Quadrado", svc: "plus",    status: "in_modeling", pri: "normal", owner: "u4", created: "2026-04-15" },
  { id: "pb_c10_10", clientId: "c10", contractId: "ct11", n: 10, sku: "2026-DEXCO-09-E01", csku: "MMT-PISO-REDONDO",     title: "Misturador Monocomando Piso Redondo",  svc: "plus",    status: "in_modeling", pri: "normal", owner: "u4", created: "2026-04-15" },
  { id: "pb_c10_11", clientId: "c10", contractId: "ct11", n: 11, sku: "2026-DEXCO-10-E01", csku: "TOALHEIRO-TERMICO",    title: "Toalheiro Térmico de Parede 127V",     svc: "plus",    status: "in_modeling", pri: "normal", owner: "u4", created: "2026-04-15" },

  // ============================================================
  // JADER ALMEIDA (c14) — 30+ produtos
  // ============================================================
  { id: "pb_c14_1",  clientId: "c14", contractId: "ct14", n: 1,  sku: "2024-JA-E01-01", csku: "MJ-HOLD",            title: "Mesa de Jantar Hold",         svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-08-15", published: "2025-06-01" },
  { id: "pb_c14_2",  clientId: "c14", contractId: "ct14", n: 2,  sku: "2024-JA-E01-05", csku: "POLTRONA-MEL",       title: "Poltrona Mel",                svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-08-15", published: "2025-06-15" },
  { id: "pb_c14_3",  clientId: "c14", contractId: "ct14", n: 3,  sku: "2024-JA-E01-06", csku: "POLTRONA-CITTE",     title: "Poltrona Citte",              svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-08-15", published: "2025-06-15" },
  { id: "pb_c14_4",  clientId: "c14", contractId: "ct14", n: 4,  sku: "2024-JA-E01-07", csku: "POLTRONA-DUMONT",    title: "Poltrona Dumont",             svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-09-01", published: "2025-07-01" },
  { id: "pb_c14_5",  clientId: "c14", contractId: "ct14", n: 5,  sku: "2024-JA-E01-08", csku: "CARRINHO-CHA-TECA",  title: "Carrinho de Chá Teca",        svc: "standard", status: "published",   pri: "normal", owner: "u4", backup: "u5", created: "2024-09-01", published: "2025-07-01" },
  { id: "pb_c14_6",  clientId: "c14", contractId: "ct14", n: 6,  sku: "2024-JA-E01-10", csku: "SOFA-BRIH",          title: "Sofá Brih",                   svc: "ultra", status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-09-15", published: "2025-07-15" },
  { id: "pb_c14_7",  clientId: "c14", contractId: "ct14", n: 7,  sku: "2024-JA-E01-11", csku: "POLTRONA-BALLI",     title: "Poltrona Balli",              svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-09-15", published: "2025-07-25" },
  { id: "pb_c14_8",  clientId: "c14", contractId: "ct14", n: 8,  sku: "2024-JA-E01-13", csku: "BANQUETA-DOTY-GIR",  title: "Banqueta Doty Giratória",     svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-10-01", published: "2025-08-05" },
  { id: "pb_c14_9",  clientId: "c14", contractId: "ct14", n: 9,  sku: "2024-JA-E01-14", csku: "MJ-JAZZ",            title: "Mesa de Jantar Jazz",         svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-10-01", published: "2025-08-15" },
  { id: "pb_c14_10", clientId: "c14", contractId: "ct14", n: 10, sku: "2024-JA-E01-15", csku: "PENDENTE-NON",       title: "Pendente Non",                svc: "standard", status: "published",   pri: "normal", owner: "u4", backup: "u5", created: "2024-10-15", published: "2025-08-25" },
  { id: "pb_c14_11", clientId: "c14", contractId: "ct14", n: 11, sku: "2024-JA-E01-16", csku: "CADEIRA-DUE",        title: "Cadeira Due",                 svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-10-15", published: "2025-09-05" },
  { id: "pb_c14_12", clientId: "c14", contractId: "ct14", n: 12, sku: "2024-JA-E01-17", csku: "ESTANTE-BYRON",      title: "Estante Byron",               svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-11-01", published: "2025-09-15" },
  { id: "pb_c14_13", clientId: "c14", contractId: "ct14", n: 13, sku: "2024-JA-E02-19", csku: "CADEIRA-BOSSA",      title: "Cadeira Bossa",               svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-11-15", published: "2025-10-01" },
  { id: "pb_c14_14", clientId: "c14", contractId: "ct14", n: 14, sku: "2024-JA-E02-20", csku: "CADEIRA-MILLA",      title: "Cadeira Milla",               svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-11-15", published: "2025-10-10" },
  { id: "pb_c14_15", clientId: "c14", contractId: "ct14", n: 15, sku: "2024-JA-E02-23", csku: "CADEIRA-EASY-MAD",   title: "Cadeira Easy Madeira",        svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-12-01", published: "2025-10-25" },
  { id: "pb_c14_16", clientId: "c14", contractId: "ct14", n: 16, sku: "2024-JA-E02-25", csku: "CADEIRA-ANNA",       title: "Cadeira Anna",                svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-12-01", published: "2025-10-30" },
  { id: "pb_c14_17", clientId: "c14", contractId: "ct14", n: 17, sku: "2024-JA-E02-26", csku: "CADEIRA-DREY-I",     title: "Cadeira Drey I",              svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-12-15", published: "2025-11-05" },
  { id: "pb_c14_18", clientId: "c14", contractId: "ct14", n: 18, sku: "2024-JA-E02-28", csku: "CADEIRA-OLIVE",      title: "Cadeira Olive",               svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-12-15", published: "2025-11-15" },
  { id: "pb_c14_19", clientId: "c14", contractId: "ct14", n: 19, sku: "2024-JA-E02-29", csku: "CADEIRA-DERBY",      title: "Cadeira Derby",               svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2024-12-15", published: "2025-11-15" },
  { id: "pb_c14_20", clientId: "c14", contractId: "ct14", n: 20, sku: "2024-JA-E02-30", csku: "CADEIRA-WINDSOR",    title: "Cadeira Windsor",             svc: "plus",  status: "published",      pri: "normal", owner: "u3", backup: "u5", created: "2025-01-01", published: "2025-12-01" },
  { id: "pb_c14_21", clientId: "c14", contractId: "ct14", n: 21, sku: "2024-JA-E02-31", csku: "POLTRONA-MAD",       title: "Poltrona Mad",                svc: "plus",  status: "internal_review",pri: "normal", owner: "u5", backup: "u3", created: "2025-01-15" },
  { id: "pb_c14_22", clientId: "c14", contractId: "ct14", n: 22, sku: "2024-JA-E02-33", csku: "POLTRONA-MAY",       title: "Poltrona May",                svc: "plus",  status: "internal_review",pri: "normal", owner: "u5", backup: "u3", created: "2025-01-15" },
  { id: "pb_c14_23", clientId: "c14", contractId: "ct14", n: 23, sku: "2024-JA-E02-34", csku: "POLTRONA-CELINE",    title: "Poltrona Celine",             svc: "plus",  status: "in_programming", pri: "normal", owner: "u5", backup: "u3", created: "2025-02-01" },
  { id: "pb_c14_24", clientId: "c14", contractId: "ct14", n: 24, sku: "2024-JA-E02-35", csku: "POLTRONA-DORA",      title: "Poltrona Dora",               svc: "plus",  status: "in_programming", pri: "normal", owner: "u5", backup: "u3", created: "2025-02-01" },
  { id: "pb_c14_25", clientId: "c14", contractId: "ct14", n: 25, sku: "2024-JA-E02-36", csku: "POLTRONA-MIA",       title: "Poltrona Mia",                svc: "plus",  status: "in_modeling",    pri: "normal", owner: "u4",              created: "2025-02-15" },

  // ============================================================
  // CHRISTIE (c12) — sem produtos no Banco de Produtos (em definição)
  // CADEIRAS ROSA (c13) — sem produtos no Banco de Produtos (em definição)
  // ARCTEFACTO (c15) — sem produtos no Banco de Produtos (em definição)
  // (não geramos blocos para esses clientes; ver MIGRATED_CONTRACTS)
  // ============================================================
];

// ============================================================
// TICKETS DE PRODUÇÃO (gerados a partir dos blocks ativos)
// Convenção:
//  - "in_modeling"     -> ticket "in_production"   atribuído a u4 (Igor / Modelagem)
//  - "in_programming"  -> ticket "in_production"   atribuído a u5 (Lucas / Programação)
//  - "internal_review" -> ticket "internal_review" atribuído a u3 (Victor / Sênior)
//  - "published"       -> ticket "delivered"
// SLA padrão para tickets ativos: created + 14 dias.
// IDs: tk_{clientCode}_{n}
// ============================================================
export const MIGRATED_TICKETS: ProductionTicket[] = [
  // ESCAL — tickets ativos para todos os c1_7..c1_31 (não-published)
  { id: "tk_escal_1",  clientId: "c1", blockId: "pb_c1_7",  title: "Poltrona Kalla – Modelagem",          plan: "plus",     slaDate: "2025-09-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_escal_2",  clientId: "c1", blockId: "pb_c1_8",  title: "Poltrona Hug – Programação 3D",       plan: "plus",     slaDate: "2025-09-29", priority: "normal", assignedTo: "u5", status: "in_production" },
  { id: "tk_escal_3",  clientId: "c1", blockId: "pb_c1_9",  title: "Banqueta Loai E02 – Revisão Interna", plan: "plus",     slaDate: "2025-10-15", priority: "normal", assignedTo: "u3", status: "internal_review" },
  { id: "tk_escal_4",  clientId: "c1", blockId: "pb_c1_10", title: "Aparador Nascar – Modelagem",         plan: "plus",     slaDate: "2025-09-29", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_escal_5",  clientId: "c1", blockId: "pb_c1_11", title: "Poltrona Margot E01 – Programação",   plan: "plus",     slaDate: "2025-08-15", priority: "high",   assignedTo: "u5", status: "in_production" },
  { id: "tk_escal_6",  clientId: "c1", blockId: "pb_c1_12", title: "Banqueta Hug – Modelagem",            plan: "plus",     slaDate: "2025-10-29", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_escal_7",  clientId: "c1", blockId: "pb_c1_13", title: "Espelho Heron – Programação",         plan: "standard", slaDate: "2025-08-29", priority: "normal", assignedTo: "u5", status: "in_production" },
  { id: "tk_escal_8",  clientId: "c1", blockId: "pb_c1_14", title: "Cadeira Ayla – Revisão Interna",      plan: "plus",     slaDate: "2025-09-15", priority: "normal", assignedTo: "u3", status: "internal_review" },
  { id: "tk_escal_9",  clientId: "c1", blockId: "pb_c1_15", title: "Banqueta Cloe – Modelagem",           plan: "plus",     slaDate: "2025-11-03", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_escal_10", clientId: "c1", blockId: "pb_c1_16", title: "Cadeira Hug – Modelagem",             plan: "plus",     slaDate: "2025-11-03", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_escal_11", clientId: "c1", blockId: "pb_c1_17", title: "Banco Less Escal – Programação",      plan: "standard", slaDate: "2025-09-24", priority: "normal", assignedTo: "u5", status: "in_production" },
  { id: "tk_escal_12", clientId: "c1", blockId: "pb_c1_18", title: "Cadeira Klara – Modelagem",           plan: "plus",     slaDate: "2025-11-08", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_escal_13", clientId: "c1", blockId: "pb_c1_19", title: "Cadeira Cloe – Modelagem",            plan: "plus",     slaDate: "2025-11-08", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_escal_14", clientId: "c1", blockId: "pb_c1_20", title: "Cadeira Office Soul – Programação",   plan: "plus",     slaDate: "2025-10-09", priority: "normal", assignedTo: "u5", status: "in_production" },
  { id: "tk_escal_15", clientId: "c1", blockId: "pb_c1_21", title: "Mesa Centro Stone – Modelagem",       plan: "standard", slaDate: "2026-02-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_escal_16", clientId: "c1", blockId: "pb_c1_22", title: "Carrinho Nascar – Modelagem",         plan: "standard", slaDate: "2026-03-01", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_escal_17", clientId: "c1", blockId: "pb_c1_23", title: "Mesa Centro Lagos – Modelagem",       plan: "standard", slaDate: "2026-03-01", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_escal_18", clientId: "c1", blockId: "pb_c1_24", title: "Mesa Aux Grace – Modelagem",          plan: "standard", slaDate: "2026-03-01", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_escal_19", clientId: "c1", blockId: "pb_c1_25", title: "Mesa Centro Livv – Modelagem",        plan: "standard", slaDate: "2026-03-01", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_escal_20", clientId: "c1", blockId: "pb_c1_26", title: "Mesa Aux Mary E03 – Modelagem",       plan: "standard", slaDate: "2026-01-29", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_escal_21", clientId: "c1", blockId: "pb_c1_27", title: "Mesa Cabeceira Nascar – Modelagem",   plan: "standard", slaDate: "2026-03-29", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_escal_22", clientId: "c1", blockId: "pb_c1_28", title: "Estante Grid – Modelagem",            plan: "plus",     slaDate: "2026-01-24", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_escal_23", clientId: "c1", blockId: "pb_c1_29", title: "Puff Umma E02 – Programação",         plan: "standard", slaDate: "2025-09-15", priority: "normal", assignedTo: "u5", status: "in_production" },
  { id: "tk_escal_24", clientId: "c1", blockId: "pb_c1_30", title: "Puff Luck – Modelagem",               plan: "standard", slaDate: "2025-12-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_escal_25", clientId: "c1", blockId: "pb_c1_31", title: "Poltrona Emy – Modelagem",            plan: "plus",     slaDate: "2025-12-29", priority: "normal", assignedTo: "u4", status: "in_production" },

  // ESTÚDIO BOLA — tickets ativos para c2_24..c2_46 (não-published)
  { id: "tk_eb_1",  clientId: "c2", blockId: "pb_c2_24", title: "Centro Aros – Revisão Interna",         plan: "plus",     slaDate: "2025-08-15", priority: "normal", assignedTo: "u3", status: "internal_review" },
  { id: "tk_eb_2",  clientId: "c2", blockId: "pb_c2_25", title: "Centro Cavaletta – Programação",        plan: "plus",     slaDate: "2025-08-15", priority: "normal", assignedTo: "u5", status: "in_production" },
  { id: "tk_eb_3",  clientId: "c2", blockId: "pb_c2_26", title: "Cama Less – Programação",               plan: "ultra",    slaDate: "2025-08-29", priority: "high",   assignedTo: "u5", status: "in_production" },
  { id: "tk_eb_4",  clientId: "c2", blockId: "pb_c2_27", title: "Jantar Cavaletta – Modelagem",          plan: "plus",     slaDate: "2025-11-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_eb_5",  clientId: "c2", blockId: "pb_c2_28", title: "Jantar Concrete – Modelagem",           plan: "plus",     slaDate: "2025-11-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_eb_6",  clientId: "c2", blockId: "pb_c2_29", title: "Jantar Concrete Garoni – Modelagem",    plan: "plus",     slaDate: "2025-11-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_eb_7",  clientId: "c2", blockId: "pb_c2_30", title: "Jantar Palma – Modelagem",              plan: "plus",     slaDate: "2025-11-29", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_eb_8",  clientId: "c2", blockId: "pb_c2_31", title: "Jantar Pilotis – Modelagem",            plan: "plus",     slaDate: "2025-11-29", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_eb_9",  clientId: "c2", blockId: "pb_c2_32", title: "Jantar Triz Pedra – Modelagem",         plan: "plus",     slaDate: "2025-12-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_eb_10", clientId: "c2", blockId: "pb_c2_33", title: "Lateral Ardea E04 – Modelagem",         plan: "standard", slaDate: "2025-12-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_eb_11", clientId: "c2", blockId: "pb_c2_34", title: "Lateral Balloon Granilite – Modelagem", plan: "standard", slaDate: "2026-01-24", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_eb_12", clientId: "c2", blockId: "pb_c2_35", title: "Lateral Barney – Modelagem",            plan: "standard", slaDate: "2026-01-24", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_eb_13", clientId: "c2", blockId: "pb_c2_36", title: "Lateral Fit – Modelagem",               plan: "standard", slaDate: "2026-01-24", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_eb_14", clientId: "c2", blockId: "pb_c2_37", title: "Lateral Ninho Allen – Modelagem",       plan: "standard", slaDate: "2026-01-24", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_eb_15", clientId: "c2", blockId: "pb_c2_38", title: "Centro Fit – Modelagem",                plan: "standard", slaDate: "2026-01-29", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_eb_16", clientId: "c2", blockId: "pb_c2_39", title: "Lateral Sabia – Modelagem",             plan: "standard", slaDate: "2026-02-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_eb_17", clientId: "c2", blockId: "pb_c2_40", title: "Aparador Pilotis – Modelagem",          plan: "plus",     slaDate: "2026-02-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_eb_18", clientId: "c2", blockId: "pb_c2_41", title: "Buffet Fillet – Modelagem",             plan: "plus",     slaDate: "2026-02-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_eb_19", clientId: "c2", blockId: "pb_c2_42", title: "Buffet Pilotis – Modelagem",            plan: "plus",     slaDate: "2026-02-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_eb_20", clientId: "c2", blockId: "pb_c2_43", title: "Cadeira Helo – Modelagem",              plan: "plus",     slaDate: "2026-03-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_eb_21", clientId: "c2", blockId: "pb_c2_44", title: "Cadeira Orla – Modelagem",              plan: "plus",     slaDate: "2026-03-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_eb_22", clientId: "c2", blockId: "pb_c2_45", title: "ML Araripe Pedra – Modelagem",          plan: "standard", slaDate: "2026-04-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_eb_23", clientId: "c2", blockId: "pb_c2_46", title: "ML Olivia – Modelagem",                 plan: "standard", slaDate: "2026-04-15", priority: "normal", assignedTo: "u4", status: "in_production" },

  // WENTZ — tickets ativos para c3_9..c3_26
  { id: "tk_wentz_1",  clientId: "c3", blockId: "pb_c3_9",  title: "Cama Baixa – Programação",            plan: "ultra",    slaDate: "2025-05-15", priority: "high",   assignedTo: "u5", status: "in_production" },
  { id: "tk_wentz_2",  clientId: "c3", blockId: "pb_c3_10", title: "Pufe Baixo – Programação",            plan: "standard", slaDate: "2025-05-15", priority: "normal", assignedTo: "u5", status: "in_production" },
  { id: "tk_wentz_3",  clientId: "c3", blockId: "pb_c3_11", title: "Mesa Centro Tábua 01 – Modelagem",    plan: "plus",     slaDate: "2025-11-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_wentz_4",  clientId: "c3", blockId: "pb_c3_12", title: "Mesa Centro Tábua 02 – Modelagem",    plan: "plus",     slaDate: "2025-11-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_wentz_5",  clientId: "c3", blockId: "pb_c3_13", title: "Mesa Lateral Tábua – Modelagem",      plan: "standard", slaDate: "2025-11-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_wentz_6",  clientId: "c3", blockId: "pb_c3_14", title: "Banco Tábua – Modelagem",             plan: "standard", slaDate: "2025-11-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_wentz_7",  clientId: "c3", blockId: "pb_c3_15", title: "Mesa Jantar Volta – Modelagem",       plan: "plus",     slaDate: "2025-11-29", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_wentz_8",  clientId: "c3", blockId: "pb_c3_16", title: "MJ Retang Volta – Modelagem",         plan: "plus",     slaDate: "2025-11-29", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_wentz_9",  clientId: "c3", blockId: "pb_c3_17", title: "Mesa Chá Volta – Modelagem",          plan: "standard", slaDate: "2025-11-29", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_wentz_10", clientId: "c3", blockId: "pb_c3_18", title: "Mesa Centro Volta – Modelagem",       plan: "plus",     slaDate: "2025-11-29", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_wentz_11", clientId: "c3", blockId: "pb_c3_19", title: "Mesa Lateral Volta – Modelagem",      plan: "standard", slaDate: "2025-11-29", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_wentz_12", clientId: "c3", blockId: "pb_c3_20", title: "Cadeira Tela – Modelagem",            plan: "plus",     slaDate: "2025-12-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_wentz_13", clientId: "c3", blockId: "pb_c3_21", title: "MJ Encaixe – Modelagem",              plan: "plus",     slaDate: "2026-03-01", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_wentz_14", clientId: "c3", blockId: "pb_c3_22", title: "Mesa Apoio Encaixe – Modelagem",      plan: "standard", slaDate: "2026-03-01", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_wentz_15", clientId: "c3", blockId: "pb_c3_23", title: "Totem Encaixe – Modelagem",           plan: "standard", slaDate: "2026-03-01", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_wentz_16", clientId: "c3", blockId: "pb_c3_24", title: "Armário Encaixe – Modelagem",         plan: "plus",     slaDate: "2026-03-01", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_wentz_17", clientId: "c3", blockId: "pb_c3_25", title: "Aparador Encaixe – Modelagem",        plan: "plus",     slaDate: "2026-03-01", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_wentz_18", clientId: "c3", blockId: "pb_c3_26", title: "Console Encaixe – Modelagem",         plan: "plus",     slaDate: "2026-03-01", priority: "normal", assignedTo: "u4", status: "in_production" },

  // MINIMAL DESIGN
  { id: "tk_minimal_1",  clientId: "c4", blockId: "pb_c4_4",  title: "Cabine Play Média – Programação",       plan: "standard", slaDate: "2025-08-29", priority: "normal", assignedTo: "u5", status: "in_production" },
  { id: "tk_minimal_2",  clientId: "c4", blockId: "pb_c4_5",  title: "Cabine Play Grande – Programação",      plan: "standard", slaDate: "2025-08-29", priority: "normal", assignedTo: "u5", status: "in_production" },
  { id: "tk_minimal_3",  clientId: "c4", blockId: "pb_c4_6",  title: "Cabine Leo XP – Modelagem",              plan: "standard", slaDate: "2025-09-29", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_minimal_4",  clientId: "c4", blockId: "pb_c4_7",  title: "Cabine Leo P – Modelagem",               plan: "standard", slaDate: "2025-09-29", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_minimal_5",  clientId: "c4", blockId: "pb_c4_8",  title: "Cabine Leo M – Modelagem",               plan: "standard", slaDate: "2025-09-29", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_minimal_6",  clientId: "c4", blockId: "pb_c4_9",  title: "Cabine Leo G – Modelagem",               plan: "standard", slaDate: "2025-09-29", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_minimal_7",  clientId: "c4", blockId: "pb_c4_10", title: "Cabine Bine XP – Modelagem",             plan: "standard", slaDate: "2025-10-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_minimal_8",  clientId: "c4", blockId: "pb_c4_11", title: "Cabine Bine P – Modelagem",              plan: "standard", slaDate: "2025-10-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_minimal_9",  clientId: "c4", blockId: "pb_c4_12", title: "Cabine Bine Intermediária – Modelagem", plan: "standard", slaDate: "2025-10-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_minimal_10", clientId: "c4", blockId: "pb_c4_13", title: "Cabine Bine M – Modelagem",              plan: "standard", slaDate: "2025-10-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_minimal_11", clientId: "c4", blockId: "pb_c4_14", title: "Cabine Bine G – Modelagem",              plan: "standard", slaDate: "2025-10-15", priority: "normal", assignedTo: "u4", status: "in_production" },

  // RS DESIGN — todos em modelagem
  { id: "tk_rs_1",  clientId: "c5", blockId: "pb_c5_1",  title: "Poltrona Casulo Nido – Modelagem",  plan: "plus",     slaDate: "2025-09-29", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_rs_2",  clientId: "c5", blockId: "pb_c5_2",  title: "Cadeira Axis – Modelagem",          plan: "plus",     slaDate: "2025-09-29", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_rs_3",  clientId: "c5", blockId: "pb_c5_3",  title: "Sofá Casulo Nido – Modelagem",      plan: "ultra",    slaDate: "2025-09-29", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_rs_4",  clientId: "c5", blockId: "pb_c5_4",  title: "Pufe Versa Baixo Grand – Modelagem",plan: "standard", slaDate: "2025-09-29", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_rs_5",  clientId: "c5", blockId: "pb_c5_5",  title: "Cabine Nido Individual – Modelagem",plan: "plus",     slaDate: "2025-10-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_rs_6",  clientId: "c5", blockId: "pb_c5_6",  title: "Sofá Nido Alto Individual – Modelagem", plan: "ultra", slaDate: "2025-10-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_rs_7",  clientId: "c5", blockId: "pb_c5_7",  title: "Sofá Nido Alto Duo – Modelagem",    plan: "ultra",    slaDate: "2025-10-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_rs_8",  clientId: "c5", blockId: "pb_c5_8",  title: "Poltrona Nido – Modelagem",         plan: "plus",     slaDate: "2025-10-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_rs_9",  clientId: "c5", blockId: "pb_c5_9",  title: "Sofá Nido Duo – Modelagem",         plan: "ultra",    slaDate: "2025-10-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_rs_10", clientId: "c5", blockId: "pb_c5_10", title: "Arquibancada Aris – Modelagem",     plan: "plus",     slaDate: "2025-10-29", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_rs_11", clientId: "c5", blockId: "pb_c5_11", title: "Sofá Trama – Modelagem",            plan: "ultra",    slaDate: "2025-10-29", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_rs_12", clientId: "c5", blockId: "pb_c5_12", title: "Sofá My Space – Modelagem",         plan: "ultra",    slaDate: "2025-10-29", priority: "normal", assignedTo: "u4", status: "in_production" },
  // c5_13..c5_20 são placeholders de baixa prioridade — gerar tickets com prioridade low e prazo distante
  { id: "tk_rs_13", clientId: "c5", blockId: "pb_c5_13", title: "RS Design 13 – Aguardando definição", plan: "standard", slaDate: "2026-06-30", priority: "low",  status: "new" },
  { id: "tk_rs_14", clientId: "c5", blockId: "pb_c5_14", title: "RS Design 14 – Aguardando definição", plan: "standard", slaDate: "2026-06-30", priority: "low",  status: "new" },
  { id: "tk_rs_15", clientId: "c5", blockId: "pb_c5_15", title: "RS Design 15 – Aguardando definição", plan: "standard", slaDate: "2026-06-30", priority: "low",  status: "new" },
  { id: "tk_rs_16", clientId: "c5", blockId: "pb_c5_16", title: "RS Design 16 – Aguardando definição", plan: "standard", slaDate: "2026-06-30", priority: "low",  status: "new" },
  { id: "tk_rs_17", clientId: "c5", blockId: "pb_c5_17", title: "RS Design 17 – Aguardando definição", plan: "standard", slaDate: "2026-06-30", priority: "low",  status: "new" },
  { id: "tk_rs_18", clientId: "c5", blockId: "pb_c5_18", title: "RS Design 18 – Aguardando definição", plan: "standard", slaDate: "2026-06-30", priority: "low",  status: "new" },
  { id: "tk_rs_19", clientId: "c5", blockId: "pb_c5_19", title: "RS Design 19 – Aguardando definição", plan: "standard", slaDate: "2026-06-30", priority: "low",  status: "new" },
  { id: "tk_rs_20", clientId: "c5", blockId: "pb_c5_20", title: "RS Design 20 – Aguardando definição", plan: "standard", slaDate: "2026-06-30", priority: "low",  status: "new" },

  // HUNTER DOUGLAS — 1 ticket em revisão interna
  { id: "tk_hd_1",  clientId: "c7", blockId: "pb_c7_1", title: "Persiana Country Woods – Revisão Interna", plan: "plus", slaDate: "2026-04-24", priority: "high", assignedTo: "u3", status: "internal_review" },

  // PEDRO FRANCO — c9_17..c9_20 não-published
  { id: "tk_pf_1",  clientId: "c9", blockId: "pb_c9_17", title: "Cadeira Fla – Revisão Interna",       plan: "plus",  slaDate: "2025-01-29", priority: "normal", assignedTo: "u3", status: "internal_review" },
  { id: "tk_pf_2",  clientId: "c9", blockId: "pb_c9_18", title: "Poltrona Supernova – Programação",    plan: "plus",  slaDate: "2025-01-29", priority: "normal", assignedTo: "u5", status: "in_production" },
  { id: "tk_pf_3",  clientId: "c9", blockId: "pb_c9_19", title: "Poltrona Underc – Programação",       plan: "plus",  slaDate: "2025-01-29", priority: "normal", assignedTo: "u5", status: "in_production" },
  { id: "tk_pf_4",  clientId: "c9", blockId: "pb_c9_20", title: "Sofá Underc – Programação",           plan: "ultra", slaDate: "2025-02-15", priority: "high",   assignedTo: "u5", status: "in_production" },

  // DEXCO — todos em modelagem
  { id: "tk_dexco_1",  clientId: "c10", blockId: "pb_c10_2",  title: "Bica Mesa P Wave – Modelagem",       plan: "standard", slaDate: "2026-03-29", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_dexco_2",  clientId: "c10", blockId: "pb_c10_3",  title: "Bica Mesa M Wave – Modelagem",       plan: "standard", slaDate: "2026-03-29", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_dexco_3",  clientId: "c10", blockId: "pb_c10_4",  title: "Bica Mesa P Memphis – Modelagem",    plan: "standard", slaDate: "2026-04-03", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_dexco_4",  clientId: "c10", blockId: "pb_c10_5",  title: "Bica Mesa M Memphis – Modelagem",    plan: "standard", slaDate: "2026-04-03", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_dexco_5",  clientId: "c10", blockId: "pb_c10_6",  title: "Bica Mesa P Redonda – Modelagem",    plan: "standard", slaDate: "2026-04-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_dexco_6",  clientId: "c10", blockId: "pb_c10_7",  title: "Bica Mesa M Redonda – Modelagem",    plan: "standard", slaDate: "2026-04-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_dexco_7",  clientId: "c10", blockId: "pb_c10_8",  title: "Bica Mesa G Redonda – Modelagem",    plan: "standard", slaDate: "2026-04-15", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_dexco_8",  clientId: "c10", blockId: "pb_c10_9",  title: "Misturador Mono Quadrado – Modelagem", plan: "plus",   slaDate: "2026-04-29", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_dexco_9",  clientId: "c10", blockId: "pb_c10_10", title: "Misturador Mono Redondo – Modelagem", plan: "plus",    slaDate: "2026-04-29", priority: "normal", assignedTo: "u4", status: "in_production" },
  { id: "tk_dexco_10", clientId: "c10", blockId: "pb_c10_11", title: "Toalheiro Térmico – Modelagem",       plan: "plus",    slaDate: "2026-04-29", priority: "normal", assignedTo: "u4", status: "in_production" },

  // JADER ALMEIDA — c14_21..c14_25 não-published
  { id: "tk_jader_1", clientId: "c14", blockId: "pb_c14_21", title: "Poltrona Mad – Revisão Interna",  plan: "plus", slaDate: "2025-01-29", priority: "normal", assignedTo: "u3", status: "internal_review" },
  { id: "tk_jader_2", clientId: "c14", blockId: "pb_c14_22", title: "Poltrona May – Revisão Interna",  plan: "plus", slaDate: "2025-01-29", priority: "normal", assignedTo: "u3", status: "internal_review" },
  { id: "tk_jader_3", clientId: "c14", blockId: "pb_c14_23", title: "Poltrona Celine – Programação",   plan: "plus", slaDate: "2025-02-15", priority: "normal", assignedTo: "u5", status: "in_production" },
  { id: "tk_jader_4", clientId: "c14", blockId: "pb_c14_24", title: "Poltrona Dora – Programação",     plan: "plus", slaDate: "2025-02-15", priority: "normal", assignedTo: "u5", status: "in_production" },
  { id: "tk_jader_5", clientId: "c14", blockId: "pb_c14_25", title: "Poltrona Mia – Modelagem",        plan: "plus", slaDate: "2025-03-01", priority: "normal", assignedTo: "u4", status: "in_production" },
];

// ============================================================
// PUBLICATIONS — para todos os blocos com status "published"
// URLs no padrão Notion "Link atual": https://explorar.archtechtour.com/{slug}/ver-N/{kebab}/index.html
// Embed code: WJ style (com permissões camera/gyroscope/AR)
// ============================================================
const buildEmbed = (url: string) =>
  `<iframe width="100%" height="640px" frameborder="0" src="${url}" allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"></iframe>`;

export const MIGRATED_PUBLICATIONS: SeedPub[] = [
  // ESTÚDIO BOLA — produtos publicados (15 itens)
  { id: "pub_c2_1",  blockId: "pb_c2_9",  url: "https://explorar.archtechtour.com/estudio-bola/ver-8/banco-kork/index.html",         embed: buildEmbed("https://explorar.archtechtour.com/estudio-bola/ver-8/banco-kork/index.html"),         env: "production", v: 8 },
  { id: "pub_c2_2",  blockId: "pb_c2_10", url: "https://explorar.archtechtour.com/estudio-bola/ver-8/banqueta-viki/index.html",      embed: buildEmbed("https://explorar.archtechtour.com/estudio-bola/ver-8/banqueta-viki/index.html"),      env: "production", v: 8 },
  { id: "pub_c2_3",  blockId: "pb_c2_11", url: "https://explorar.archtechtour.com/estudio-bola/ver-8/banco-cave/index.html",         embed: buildEmbed("https://explorar.archtechtour.com/estudio-bola/ver-8/banco-cave/index.html"),         env: "production", v: 8 },
  { id: "pub_c2_4",  blockId: "pb_c2_12", url: "https://explorar.archtechtour.com/estudio-bola/ver-8/banco-carretel/index.html",     embed: buildEmbed("https://explorar.archtechtour.com/estudio-bola/ver-8/banco-carretel/index.html"),     env: "production", v: 8 },
  { id: "pub_c2_5",  blockId: "pb_c2_13", url: "https://explorar.archtechtour.com/estudio-bola/ver-8/banco-bacuri/index.html",       embed: buildEmbed("https://explorar.archtechtour.com/estudio-bola/ver-8/banco-bacuri/index.html"),       env: "production", v: 8 },
  { id: "pub_c2_6",  blockId: "pb_c2_14", url: "https://explorar.archtechtour.com/estudio-bola/ver-8/banco-viki/index.html",         embed: buildEmbed("https://explorar.archtechtour.com/estudio-bola/ver-8/banco-viki/index.html"),         env: "production", v: 8 },
  { id: "pub_c2_7",  blockId: "pb_c2_15", url: "https://explorar.archtechtour.com/estudio-bola/ver-8/banqueta-helga/index.html",     embed: buildEmbed("https://explorar.archtechtour.com/estudio-bola/ver-8/banqueta-helga/index.html"),     env: "production", v: 8 },
  { id: "pub_c2_8",  blockId: "pb_c2_16", url: "https://explorar.archtechtour.com/estudio-bola/ver-8/banqueta-luisa/index.html",     embed: buildEmbed("https://explorar.archtechtour.com/estudio-bola/ver-8/banqueta-luisa/index.html"),     env: "production", v: 8 },
  { id: "pub_c2_9",  blockId: "pb_c2_17", url: "https://explorar.archtechtour.com/estudio-bola/ver-9/poltrona-acacia/index.html",    embed: buildEmbed("https://explorar.archtechtour.com/estudio-bola/ver-9/poltrona-acacia/index.html"),    env: "production", v: 9 },
  { id: "pub_c2_10", blockId: "pb_c2_18", url: "https://explorar.archtechtour.com/estudio-bola/ver-9/poltrona-lala-e02/index.html",  embed: buildEmbed("https://explorar.archtechtour.com/estudio-bola/ver-9/poltrona-lala-e02/index.html"),  env: "production", v: 9 },
  { id: "pub_c2_11", blockId: "pb_c2_19", url: "https://explorar.archtechtour.com/estudio-bola/ver-9/poltrona-less/index.html",      embed: buildEmbed("https://explorar.archtechtour.com/estudio-bola/ver-9/poltrona-less/index.html"),      env: "production", v: 9 },
  { id: "pub_c2_12", blockId: "pb_c2_20", url: "https://explorar.archtechtour.com/estudio-bola/ver-9/poltrona-luisa/index.html",     embed: buildEmbed("https://explorar.archtechtour.com/estudio-bola/ver-9/poltrona-luisa/index.html"),     env: "production", v: 9 },
  { id: "pub_c2_13", blockId: "pb_c2_21", url: "https://explorar.archtechtour.com/estudio-bola/ver-9/poltrona-mabelle/index.html",   embed: buildEmbed("https://explorar.archtechtour.com/estudio-bola/ver-9/poltrona-mabelle/index.html"),   env: "production", v: 9 },
  { id: "pub_c2_14", blockId: "pb_c2_22", url: "https://explorar.archtechtour.com/estudio-bola/ver-9/poltrona-mexerica/index.html",  embed: buildEmbed("https://explorar.archtechtour.com/estudio-bola/ver-9/poltrona-mexerica/index.html"),  env: "production", v: 9 },
  { id: "pub_c2_15", blockId: "pb_c2_23", url: "https://explorar.archtechtour.com/estudio-bola/ver-9/chaise-serena/index.html",      embed: buildEmbed("https://explorar.archtechtour.com/estudio-bola/ver-9/chaise-serena/index.html"),      env: "production", v: 9 },

  // WENTZ — produtos publicados (6 itens)
  { id: "pub_c3_1", blockId: "pb_c3_3", url: "https://explorar.archtechtour.com/wentz/ver-12/cadeira-capa-e01/index.html", embed: buildEmbed("https://explorar.archtechtour.com/wentz/ver-12/cadeira-capa-e01/index.html"), env: "production", v: 12 },
  { id: "pub_c3_2", blockId: "pb_c3_4", url: "https://explorar.archtechtour.com/wentz/ver-13/poltrona-capa/index.html",    embed: buildEmbed("https://explorar.archtechtour.com/wentz/ver-13/poltrona-capa/index.html"),    env: "production", v: 13 },
  { id: "pub_c3_3", blockId: "pb_c3_5", url: "https://explorar.archtechtour.com/wentz/ver-10/sofa-fita/index.html",        embed: buildEmbed("https://explorar.archtechtour.com/wentz/ver-10/sofa-fita/index.html"),        env: "production", v: 10 },
  { id: "pub_c3_4", blockId: "pb_c3_6", url: "https://explorar.archtechtour.com/wentz/ver-10/poltrona-fita/index.html",    embed: buildEmbed("https://explorar.archtechtour.com/wentz/ver-10/poltrona-fita/index.html"),    env: "production", v: 10 },
  { id: "pub_c3_5", blockId: "pb_c3_7", url: "https://explorar.archtechtour.com/wentz/ver-10/pufe-fita/index.html",        embed: buildEmbed("https://explorar.archtechtour.com/wentz/ver-10/pufe-fita/index.html"),        env: "production", v: 10 },
  { id: "pub_c3_6", blockId: "pb_c3_8", url: "https://explorar.archtechtour.com/wentz/ver-11/cadeira-gravata-2/index.html",embed: buildEmbed("https://explorar.archtechtour.com/wentz/ver-11/cadeira-gravata-2/index.html"),env: "production", v: 11 },

  // TIDELLI — 20 produtos publicados
  { id: "pub_c6_1",  blockId: "pb_c6_1",  url: "https://explorar.archtechtour.com/tidelli/ver-8/mesa-monstera/index.html",        embed: buildEmbed("https://explorar.archtechtour.com/tidelli/ver-8/mesa-monstera/index.html"),        env: "production", v: 8 },
  { id: "pub_c6_2",  blockId: "pb_c6_2",  url: "https://explorar.archtechtour.com/tidelli/ver-8/mdc-folha-bananeira/index.html", embed: buildEmbed("https://explorar.archtechtour.com/tidelli/ver-8/mdc-folha-bananeira/index.html"), env: "production", v: 8 },
  { id: "pub_c6_3",  blockId: "pb_c6_3",  url: "https://explorar.archtechtour.com/tidelli/ver-8/cadeira-cb-caraiva/index.html",  embed: buildEmbed("https://explorar.archtechtour.com/tidelli/ver-8/cadeira-cb-caraiva/index.html"),  env: "production", v: 8 },
  { id: "pub_c6_4",  blockId: "pb_c6_4",  url: "https://explorar.archtechtour.com/tidelli/ver-8/poltrona-caraiva/index.html",    embed: buildEmbed("https://explorar.archtechtour.com/tidelli/ver-8/poltrona-caraiva/index.html"),    env: "production", v: 8 },
  { id: "pub_c6_5",  blockId: "pb_c6_5",  url: "https://explorar.archtechtour.com/tidelli/ver-8/poltrona-rec-caraiva/index.html",embed: buildEmbed("https://explorar.archtechtour.com/tidelli/ver-8/poltrona-rec-caraiva/index.html"),env: "production", v: 8 },
  { id: "pub_c6_6",  blockId: "pb_c6_6",  url: "https://explorar.archtechtour.com/tidelli/ver-8/espreguicadeira-caraiva/index.html", embed: buildEmbed("https://explorar.archtechtour.com/tidelli/ver-8/espreguicadeira-caraiva/index.html"), env: "production", v: 8 },
  { id: "pub_c6_7",  blockId: "pb_c6_7",  url: "https://explorar.archtechtour.com/tidelli/ver-8/banco-caraiva/index.html",       embed: buildEmbed("https://explorar.archtechtour.com/tidelli/ver-8/banco-caraiva/index.html"),       env: "production", v: 8 },
  { id: "pub_c6_8",  blockId: "pb_c6_8",  url: "https://explorar.archtechtour.com/tidelli/ver-8/drop/index.html",                embed: buildEmbed("https://explorar.archtechtour.com/tidelli/ver-8/drop/index.html"),                env: "production", v: 8 },
  { id: "pub_c6_9",  blockId: "pb_c6_9",  url: "https://explorar.archtechtour.com/tidelli/ver-8/cadeira-pentagramma/index.html", embed: buildEmbed("https://explorar.archtechtour.com/tidelli/ver-8/cadeira-pentagramma/index.html"), env: "production", v: 8 },
  { id: "pub_c6_10", blockId: "pb_c6_10", url: "https://explorar.archtechtour.com/tidelli/ver-8/sofa-sahara/index.html",         embed: buildEmbed("https://explorar.archtechtour.com/tidelli/ver-8/sofa-sahara/index.html"),         env: "production", v: 8 },
  { id: "pub_c6_11", blockId: "pb_c6_11", url: "https://explorar.archtechtour.com/tidelli/ver-8/cadeira-shell/index.html",       embed: buildEmbed("https://explorar.archtechtour.com/tidelli/ver-8/cadeira-shell/index.html"),       env: "production", v: 8 },
  { id: "pub_c6_12", blockId: "pb_c6_12", url: "https://explorar.archtechtour.com/tidelli/ver-8/poltrona-shell/index.html",      embed: buildEmbed("https://explorar.archtechtour.com/tidelli/ver-8/poltrona-shell/index.html"),      env: "production", v: 8 },
  { id: "pub_c6_13", blockId: "pb_c6_13", url: "https://explorar.archtechtour.com/tidelli/ver-8/namoradeira-shell/index.html",   embed: buildEmbed("https://explorar.archtechtour.com/tidelli/ver-8/namoradeira-shell/index.html"),   env: "production", v: 8 },
  { id: "pub_c6_14", blockId: "pb_c6_14", url: "https://explorar.archtechtour.com/tidelli/ver-8/apoio-monte-carlo/index.html",   embed: buildEmbed("https://explorar.archtechtour.com/tidelli/ver-8/apoio-monte-carlo/index.html"),   env: "production", v: 8 },
  { id: "pub_c6_15", blockId: "pb_c6_15", url: "https://explorar.archtechtour.com/tidelli/ver-8/banco-monte-carlo/index.html",   embed: buildEmbed("https://explorar.archtechtour.com/tidelli/ver-8/banco-monte-carlo/index.html"),   env: "production", v: 8 },
  { id: "pub_c6_16", blockId: "pb_c6_16", url: "https://explorar.archtechtour.com/tidelli/ver-8/mdj-organika/index.html",         embed: buildEmbed("https://explorar.archtechtour.com/tidelli/ver-8/mdj-organika/index.html"),         env: "production", v: 8 },
  { id: "pub_c6_17", blockId: "pb_c6_17", url: "https://explorar.archtechtour.com/tidelli/ver-8/poltrona-trap-soft/index.html",  embed: buildEmbed("https://explorar.archtechtour.com/tidelli/ver-8/poltrona-trap-soft/index.html"),  env: "production", v: 8 },
  { id: "pub_c6_18", blockId: "pb_c6_18", url: "https://explorar.archtechtour.com/tidelli/ver-8/puff-trap-soft/index.html",      embed: buildEmbed("https://explorar.archtechtour.com/tidelli/ver-8/puff-trap-soft/index.html"),      env: "production", v: 8 },
  { id: "pub_c6_19", blockId: "pb_c6_19", url: "https://explorar.archtechtour.com/tidelli/ver-8/espreg-padang/index.html",       embed: buildEmbed("https://explorar.archtechtour.com/tidelli/ver-8/espreg-padang/index.html"),       env: "production", v: 8 },
  { id: "pub_c6_20", blockId: "pb_c6_20", url: "https://explorar.archtechtour.com/tidelli/ver-8/ombrelone-caraiva/index.html",   embed: buildEmbed("https://explorar.archtechtour.com/tidelli/ver-8/ombrelone-caraiva/index.html"),   env: "production", v: 8 },

  // DOCOL — 1 publicado
  { id: "pub_c8_1", blockId: "pb_c8_1", url: "https://explorar.archtechtour.com/docol/ver-5/docol-torneira-naiade/index.html", embed: buildEmbed("https://explorar.archtechtour.com/docol/ver-5/docol-torneira-naiade/index.html"), env: "production", v: 5 },

  // PEDRO FRANCO — 16 publicados (c9_1..c9_16)
  { id: "pub_c9_1",  blockId: "pb_c9_1",  url: "https://explorar.archtechtour.com/pedro-franco/ver-7/cadeira-icone/index.html",       embed: buildEmbed("https://explorar.archtechtour.com/pedro-franco/ver-7/cadeira-icone/index.html"),       env: "production", v: 7 },
  { id: "pub_c9_2",  blockId: "pb_c9_2",  url: "https://explorar.archtechtour.com/pedro-franco/ver-7/poltrona-ancestral/index.html",  embed: buildEmbed("https://explorar.archtechtour.com/pedro-franco/ver-7/poltrona-ancestral/index.html"),  env: "production", v: 7 },
  { id: "pub_c9_3",  blockId: "pb_c9_3",  url: "https://explorar.archtechtour.com/pedro-franco/ver-7/mesa-dali/index.html",           embed: buildEmbed("https://explorar.archtechtour.com/pedro-franco/ver-7/mesa-dali/index.html"),           env: "production", v: 7 },
  { id: "pub_c9_4",  blockId: "pb_c9_4",  url: "https://explorar.archtechtour.com/pedro-franco/ver-7/ml-rupestre/index.html",         embed: buildEmbed("https://explorar.archtechtour.com/pedro-franco/ver-7/ml-rupestre/index.html"),         env: "production", v: 7 },
  { id: "pub_c9_5",  blockId: "pb_c9_5",  url: "https://explorar.archtechtour.com/pedro-franco/ver-7/poltrona-antrop/index.html",     embed: buildEmbed("https://explorar.archtechtour.com/pedro-franco/ver-7/poltrona-antrop/index.html"),     env: "production", v: 7 },
  { id: "pub_c9_6",  blockId: "pb_c9_6",  url: "https://explorar.archtechtour.com/pedro-franco/ver-7/sofa-antrop/index.html",         embed: buildEmbed("https://explorar.archtechtour.com/pedro-franco/ver-7/sofa-antrop/index.html"),         env: "production", v: 7 },
  { id: "pub_c9_7",  blockId: "pb_c9_7",  url: "https://explorar.archtechtour.com/pedro-franco/ver-7/aparador-underc/index.html",     embed: buildEmbed("https://explorar.archtechtour.com/pedro-franco/ver-7/aparador-underc/index.html"),     env: "production", v: 7 },
  { id: "pub_c9_8",  blockId: "pb_c9_8",  url: "https://explorar.archtechtour.com/pedro-franco/ver-7/cadeira-esqueleto/index.html",   embed: buildEmbed("https://explorar.archtechtour.com/pedro-franco/ver-7/cadeira-esqueleto/index.html"),   env: "production", v: 7 },
  { id: "pub_c9_9",  blockId: "pb_c9_9",  url: "https://explorar.archtechtour.com/pedro-franco/ver-7/banqueta-esqueleto/index.html",  embed: buildEmbed("https://explorar.archtechtour.com/pedro-franco/ver-7/banqueta-esqueleto/index.html"),  env: "production", v: 7 },
  { id: "pub_c9_10", blockId: "pb_c9_10", url: "https://explorar.archtechtour.com/pedro-franco/ver-7/banco-esqueleto/index.html",     embed: buildEmbed("https://explorar.archtechtour.com/pedro-franco/ver-7/banco-esqueleto/index.html"),     env: "production", v: 7 },
  { id: "pub_c9_11", blockId: "pb_c9_11", url: "https://explorar.archtechtour.com/pedro-franco/ver-7/mesa-esqueleto/index.html",      embed: buildEmbed("https://explorar.archtechtour.com/pedro-franco/ver-7/mesa-esqueleto/index.html"),      env: "production", v: 7 },
  { id: "pub_c9_12", blockId: "pb_c9_12", url: "https://explorar.archtechtour.com/pedro-franco/ver-7/aparador-esqueleto/index.html",  embed: buildEmbed("https://explorar.archtechtour.com/pedro-franco/ver-7/aparador-esqueleto/index.html"),  env: "production", v: 7 },
  { id: "pub_c9_13", blockId: "pb_c9_13", url: "https://explorar.archtechtour.com/pedro-franco/ver-7/poltrona-kaos/index.html",       embed: buildEmbed("https://explorar.archtechtour.com/pedro-franco/ver-7/poltrona-kaos/index.html"),       env: "production", v: 7 },
  { id: "pub_c9_14", blockId: "pb_c9_14", url: "https://explorar.archtechtour.com/pedro-franco/ver-7/aparador-kintsugi/index.html",   embed: buildEmbed("https://explorar.archtechtour.com/pedro-franco/ver-7/aparador-kintsugi/index.html"),   env: "production", v: 7 },
  { id: "pub_c9_15", blockId: "pb_c9_15", url: "https://explorar.archtechtour.com/pedro-franco/ver-7/mesa-kintsugi/index.html",       embed: buildEmbed("https://explorar.archtechtour.com/pedro-franco/ver-7/mesa-kintsugi/index.html"),       env: "production", v: 7 },
  { id: "pub_c9_16", blockId: "pb_c9_16", url: "https://explorar.archtechtour.com/pedro-franco/ver-7/aparador-renascenca/index.html", embed: buildEmbed("https://explorar.archtechtour.com/pedro-franco/ver-7/aparador-renascenca/index.html"), env: "production", v: 7 },

  // JADER ALMEIDA — 20 publicados (c14_1..c14_20)
  { id: "pub_c14_1",  blockId: "pb_c14_1",  url: "https://explorar.archtechtour.com/jader-almeida/ver-6/mj-hold/index.html",            embed: buildEmbed("https://explorar.archtechtour.com/jader-almeida/ver-6/mj-hold/index.html"),            env: "production", v: 6 },
  { id: "pub_c14_2",  blockId: "pb_c14_2",  url: "https://explorar.archtechtour.com/jader-almeida/ver-6/poltrona-mel/index.html",       embed: buildEmbed("https://explorar.archtechtour.com/jader-almeida/ver-6/poltrona-mel/index.html"),       env: "production", v: 6 },
  { id: "pub_c14_3",  blockId: "pb_c14_3",  url: "https://explorar.archtechtour.com/jader-almeida/ver-6/poltrona-citte/index.html",     embed: buildEmbed("https://explorar.archtechtour.com/jader-almeida/ver-6/poltrona-citte/index.html"),     env: "production", v: 6 },
  { id: "pub_c14_4",  blockId: "pb_c14_4",  url: "https://explorar.archtechtour.com/jader-almeida/ver-6/poltrona-dumont/index.html",    embed: buildEmbed("https://explorar.archtechtour.com/jader-almeida/ver-6/poltrona-dumont/index.html"),    env: "production", v: 6 },
  { id: "pub_c14_5",  blockId: "pb_c14_5",  url: "https://explorar.archtechtour.com/jader-almeida/ver-6/carrinho-cha-teca/index.html",  embed: buildEmbed("https://explorar.archtechtour.com/jader-almeida/ver-6/carrinho-cha-teca/index.html"),  env: "production", v: 6 },
  { id: "pub_c14_6",  blockId: "pb_c14_6",  url: "https://explorar.archtechtour.com/jader-almeida/ver-6/sofa-brih/index.html",          embed: buildEmbed("https://explorar.archtechtour.com/jader-almeida/ver-6/sofa-brih/index.html"),          env: "production", v: 6 },
  { id: "pub_c14_7",  blockId: "pb_c14_7",  url: "https://explorar.archtechtour.com/jader-almeida/ver-6/poltrona-balli/index.html",     embed: buildEmbed("https://explorar.archtechtour.com/jader-almeida/ver-6/poltrona-balli/index.html"),     env: "production", v: 6 },
  { id: "pub_c14_8",  blockId: "pb_c14_8",  url: "https://explorar.archtechtour.com/jader-almeida/ver-6/banqueta-doty-giratoria/index.html", embed: buildEmbed("https://explorar.archtechtour.com/jader-almeida/ver-6/banqueta-doty-giratoria/index.html"), env: "production", v: 6 },
  { id: "pub_c14_9",  blockId: "pb_c14_9",  url: "https://explorar.archtechtour.com/jader-almeida/ver-6/mj-jazz/index.html",            embed: buildEmbed("https://explorar.archtechtour.com/jader-almeida/ver-6/mj-jazz/index.html"),            env: "production", v: 6 },
  { id: "pub_c14_10", blockId: "pb_c14_10", url: "https://explorar.archtechtour.com/jader-almeida/ver-6/pendente-non/index.html",       embed: buildEmbed("https://explorar.archtechtour.com/jader-almeida/ver-6/pendente-non/index.html"),       env: "production", v: 6 },
  { id: "pub_c14_11", blockId: "pb_c14_11", url: "https://explorar.archtechtour.com/jader-almeida/ver-6/cadeira-due/index.html",        embed: buildEmbed("https://explorar.archtechtour.com/jader-almeida/ver-6/cadeira-due/index.html"),        env: "production", v: 6 },
  { id: "pub_c14_12", blockId: "pb_c14_12", url: "https://explorar.archtechtour.com/jader-almeida/ver-6/estante-byron/index.html",      embed: buildEmbed("https://explorar.archtechtour.com/jader-almeida/ver-6/estante-byron/index.html"),      env: "production", v: 6 },
  { id: "pub_c14_13", blockId: "pb_c14_13", url: "https://explorar.archtechtour.com/jader-almeida/ver-6/cadeira-bossa/index.html",      embed: buildEmbed("https://explorar.archtechtour.com/jader-almeida/ver-6/cadeira-bossa/index.html"),      env: "production", v: 6 },
  { id: "pub_c14_14", blockId: "pb_c14_14", url: "https://explorar.archtechtour.com/jader-almeida/ver-6/cadeira-milla/index.html",      embed: buildEmbed("https://explorar.archtechtour.com/jader-almeida/ver-6/cadeira-milla/index.html"),      env: "production", v: 6 },
  { id: "pub_c14_15", blockId: "pb_c14_15", url: "https://explorar.archtechtour.com/jader-almeida/ver-6/cadeira-easy-madeira/index.html", embed: buildEmbed("https://explorar.archtechtour.com/jader-almeida/ver-6/cadeira-easy-madeira/index.html"), env: "production", v: 6 },
  { id: "pub_c14_16", blockId: "pb_c14_16", url: "https://explorar.archtechtour.com/jader-almeida/ver-6/cadeira-anna/index.html",       embed: buildEmbed("https://explorar.archtechtour.com/jader-almeida/ver-6/cadeira-anna/index.html"),       env: "production", v: 6 },
  { id: "pub_c14_17", blockId: "pb_c14_17", url: "https://explorar.archtechtour.com/jader-almeida/ver-6/cadeira-drey-i/index.html",     embed: buildEmbed("https://explorar.archtechtour.com/jader-almeida/ver-6/cadeira-drey-i/index.html"),     env: "production", v: 6 },
  { id: "pub_c14_18", blockId: "pb_c14_18", url: "https://explorar.archtechtour.com/jader-almeida/ver-6/cadeira-olive/index.html",      embed: buildEmbed("https://explorar.archtechtour.com/jader-almeida/ver-6/cadeira-olive/index.html"),      env: "production", v: 6 },
  { id: "pub_c14_19", blockId: "pb_c14_19", url: "https://explorar.archtechtour.com/jader-almeida/ver-6/cadeira-derby/index.html",      embed: buildEmbed("https://explorar.archtechtour.com/jader-almeida/ver-6/cadeira-derby/index.html"),      env: "production", v: 6 },
  { id: "pub_c14_20", blockId: "pb_c14_20", url: "https://explorar.archtechtour.com/jader-almeida/ver-6/cadeira-windsor/index.html",    embed: buildEmbed("https://explorar.archtechtour.com/jader-almeida/ver-6/cadeira-windsor/index.html"),    env: "production", v: 6 },
];

// ============================================================
// SUMÁRIO DA MIGRAÇÃO (referência rápida)
// ============================================================
//
// Cliente              | Blocks | Tickets | Publications | Contract
// ---------------------+--------+---------+--------------+----------
// c1  Escal            |   25   |   25    |       0      | ct1 (já existia)
// c2  Estúdio Bola     |   38   |   23    |      15      | ct2 (já existia)
// c3  Wentz            |   24   |   18    |       6      | ct3 (já existia)
// c4  Minimal Design   |   11   |   11    |       0      | ct4 (novo)
// c5  RS Design        |   20   |   20    |       0      | ct5 (novo)
// c6  Tidelli          |   20   |    0    |      20      | ct6 (novo)
// c7  Hunter Douglas   |    1   |    1    |       0      | ct7 (novo)
// c8  Docol            |    1   |    0    |       1      | ct9 (novo)
// c9  Pedro Franco     |   20   |    4    |      16      | ct10 (novo)
// c10 DEXCO            |   10   |   10    |       0      | ct11 (novo)
// c11 WJ Luminárias    |   --   |   --    |      --      | ct8  (já em Portal.tsx)
// c12 Christie         |    0   |    0    |       0      | ct12 (novo, vazio)
// c13 Cadeiras Rosa    |    0   |    0    |       0      | ct13 (novo, vazio)
// c14 Jader Almeida    |   25   |    5    |      20      | ct14 (novo)
// c15 Arctefacto       |    0   |    0    |       0      | ct15 (novo, vazio)
// ---------------------+--------+---------+--------------+----------
// TOTAL                |  195   |  117    |      78      | 11 contratos novos
