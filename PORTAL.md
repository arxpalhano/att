# Portal ArchTechTour — Documentação Completa

> Fonte de verdade da arquitetura, estrutura e funcionamento do portal.
> Atualizado: 2026-06 · Mantido junto com o código (todo deploy passa pelo git).

---

## 1. Visão geral

Portal web de gestão e relacionamento da ArchTechTour, servindo **dois públicos**:

- **Clientes** (marcas de móveis/design): acompanham seus blocos 3D, aprovações,
  publicações e o dashboard de analytics de engajamento.
- **Equipe interna** (admin, modeladores, devs, PM): gerenciam todo o pipeline de
  produção, clientes, contratos, tickets, e operam os Agentes AI.

**URL produção:** https://app.archtechtour.com
**Repositório:** github.com/arxpalhano/att
**Branches:** `develop` (trabalho) → `main` (produção, Amplify auto-deploy).

---

## 2. Stack & Infraestrutura

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 14 (App Router, SSR) |
| Hospedagem | AWS Amplify Hosting (SSR Lambda, região sa-east-1) |
| Banco de estado | DynamoDB (us-east-1, PAY_PER_REQUEST) |
| Analytics (dados) | AWS Athena (DB `customizador_events`, us-east-1) |
| Storage | S3: `explorar.archtechtour.com` (customizadores), `archtechtour-assets` (cache analytics) |
| Auth | NextAuth + Microsoft Entra (Azure AD) SSO |
| i18n | Context React próprio (PT/EN/ES/FR) |
| IA | Claude (Haiku 4.5 + fallback Sonnet) via @anthropic-ai/sdk |

**IAM Role do SSR:** `amplify-archtechtour-portal-ssr` — políticas anexadas:
`DynamoDBPortalAccess` (7 tabelas), `AthenaGlueAccess` (Athena + Glue + S3).

**Env vars (via next.config.js `env`, pois Amplify SSR Lambda não injeta em runtime):**
`NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `AZURE_AD_CLIENT_ID/SECRET/TENANT_ID`,
`APP_AWS_REGION`, `ATHENA_DB/WORKGROUP/OUTPUT`, `ANTHROPIC_API_KEY`.

---

## 3. Autenticação

- **Microsoft SSO** (`/api/auth/[...nextauth]`): provider Azure AD. App Registration
  no Entra (tenant `fe656314-...`). Redirect: `/api/auth/callback/azure-ad`.
  Qualquer conta `@archtechtour.com` loga como **admin**.
- **Login local** (seed users em Portal.tsx + DynamoDB `att-users`): email+senha,
  para clientes e equipe. Clientes: `contato@{marca} / {alias}@2025`.

---

## 4. Internacionalização (i18n)

- `src/lib/i18n.tsx`: Context com ~200 chaves em **PT/EN/ES/FR**.
- `LanguageSwitcher` no topo de todas as páginas públicas e do portal.
- Escolha persiste em localStorage (`att-lang`). Texto do contrato legal fica em PT.

---

## 5. Modelo de dados (DynamoDB)

7 tabelas, todas com chave `id` (string), PAY_PER_REQUEST, us-east-1:

| Tabela | Conteúdo |
|--------|----------|
| `att-clients` | Marcas (id `c1..c18`, code=alias Athena, contactEmail, active) |
| `att-contracts` | Contratos (clientId, totalBlocks, usedBlocks, startDate) |
| `att-blocks` | Produtos/blocos 3D (clientId, contractId, sku, csku, title, status, svc, pri) |
| `att-publications` | Publicações (blockId, url, embed, env, v) |
| `att-tickets` | Tickets de produção (clientId, blockId, title, status, slaDate, assignedTo) |
| `att-activities` | Log de atividades (blockId, userId, type, desc, at) |
| `att-users` | Usuários do portal (email, password, name, role, clientId) |

**Hidratação/persistência:** no mount, o Portal lê todas as tabelas via `/api/state/*`.
Se vazias, faz seed inicial (de `src/data/seed.ts` + `wj-seed.ts` + hardcoded).
Mudanças persistem com debounce de 800ms. Estado compartilhado entre admin e cliente.

**Status de bloco (`BlockStatus`):** draft, awaiting_client_files, client_files_under_review,
ready_to_start, in_modeling, awaiting_client_material_validation, approved_for_programming,
in_programming, internal_review, awaiting_client_final_validation, approved, published,
blocked, on_hold, archived.

---

## 6. Páginas do portal

**Cliente:** Dashboard, Onboarding, Meus Blocos, Aprovações, Publicações, Analytics, Contratos.

**Admin/interno:** Dashboard, Tickets, Fila de Trabalho, Todos os Blocos, Aprovações,
Publicações, Analytics, Clientes, Contratos, Atividade, Usuários, **Agentes AI**.

**CRUD admin (tudo gerenciável pela UI, persiste em DynamoDB):**
- Clientes — criar/editar/desativar
- Contratos — criar/editar
- Blocos — criar (gera ticket automático) + override de status (dropdown admin)
- Publicações — adicionar/editar/remover (gera embed automático)
- Usuários — criar/editar/desativar
- Tickets — criar manual ou automático ao cadastrar bloco

**Fluxo de produção:** Cliente cadastra produto → ticket auto-criado (status `new`,
SLA +14d, sem responsável) → Jessica (PM) atribui → modelador/dev trabalha →
status atualizado → cliente vê em tempo real.

---

## 7. Analytics

**Pipeline (própria, SEM Google/GA4):**
```
Customizador → enviarEventoCustomizador()
  → POST odwlqrkix5.execute-api.us-east-1/register-event (API Gateway)
  → Lambda RegistrarEventoCustomizador → tabela raw eventos_customizador
  → Lambda parquet-monthly-etl (DIÁRIO) → Athena eventos_parquet (mês corrente+anterior)
  → Lambda analytics-compute (dia 1º) → /api/analytics/{alias}/refresh
  → cache S3 archtechtour-assets/analytics-cache/{alias}/latest.json
  → Portal lê via /api/analytics/{alias}
```
> ⚠️ As views/dashboard consultam `eventos_parquet` (particionado, rápido). Os
> eventos crus chegam em `eventos_customizador` e só entram no Parquet quando o
> parquet-monthly-etl roda. Por isso ele agora roda DIÁRIO — se o dashboard de um
> mês aparecer zerado, quase sempre é o ETL que ainda não processou aquele período
> (rode o Lambda com `{"targetMonth":"YYYY-MM"}`).

**Builder (`src/lib/analytics-builder.ts`):** 8 queries paralelas no Athena
(view `vw_eventos_base_com_cliente`, que mapeia alias→cliente via `dim_client_alias`).

**Filtro de bots (BOT_FILTER):** exclui Googlebot (UA "Nexus 5X Build/MMB29P"),
meta-externalads, facebookexternalhit, bingpreview, crawlers, headless, lighthouse,
pagespeed, monitores, e tráfego interno (localhost, explorar.archtechtour.com).

**KPIs do dashboard (honestos):**
- **Visitantes Únicos** — pessoas reais (sem bot)
- **Carregamentos** — impressões (iframe exibido; `session_start` dispara no load)
- **Engajamento Real** — interações ativas (abrir_ar + abrir_ar_ios + download_modelo + clique_whatsapp)
- **Downloads de Blocos** — CAD baixados
- Tempo Médio, Total de Eventos

> ⚠️ Importante: `session_start` dispara no LOAD do iframe (passivo), não na interação.
> Eventos de interação (AR/download/whatsapp) NÃO têm session_id. Por isso a métrica
> "Engajamento Real" é a que mede valor de negócio real.

**Insights AI** (`/api/analytics/[client]/insights`): botão no dashboard que gera
interpretação amigável dos números para o cliente (Claude Haiku).

**`dim_client_alias`** (Athena, S3 `explorar.archtechtour.com/dim/`): mapeia
alias→nome do cliente. Tem os 18 clientes. Para adicionar cliente novo ao analytics,
incluir linha aqui (CSV com header, `skip.header.line.count=1`).

---

## 8. Agentes AI (admin only)

Aba "Agentes AI" no sidebar admin. Todos herdam `src/lib/agent-context.ts` (contexto
de negócio + arquitetura) e têm função isolada. Cada um: API própria + página de chat
com histórico em localStorage. Modelo Haiku 4.5 com retry/fallback (`claude-retry.ts`).

| Agente | Personagem | Função |
|--------|-----------|--------|
| 🟧 **Sherlock Codes** | Sherlock Holmes | Caça bugs de integridade do DB (órfãos, mismatches, duplicatas). Veredito 100% pré-calculado no backend — não faz contas. |
| 🟦 **Monk Lighthouse** | Adrian Monk + Lighthouse | QA dos customizadores publicados: HTTP, analytics, downloads corretos (lê `ui.js`), AR, escala. Por cliente, todos, ou URL específica. |
| 🟢 **Yoda Kanban** | Yoda + Kanban | Gerente de projetos: saúde do portfólio, riscos, oportunidades, ações para a PM. |
| 🟣 **Harvey Closer** | Harvey Specter + Closer | Comercial/retenção: traduz analytics em valor e ações comerciais/marketing. Ajuda a reter cliente em risco de cancelamento. |

**Regra de contexto:** agentes NUNCA inventam números/preços. Usam só dados reais do
dashboard/dossiê. Fonte de verdade institucional = archtechtour.com.

---

## 9. Endpoints da API

**Estado (DynamoDB):** `GET/POST /api/state/{blocks,tickets,activities,clients,contracts,publications,users}`
(POST aceita item único ou array; array = replaceAll).

**Manutenção (admin, server-side):**
- `POST /api/state/reseed` — limpa e re-popula tabelas com seed consolidado + reconcilia contadores
- `POST /api/state/reconcile-publications` — cruza S3 ↔ DynamoDB, publica blocos que têm customizador no S3
- `POST /api/state/import-orphans` — cria blocos para customizadores S3 sem bloco (última versão de cada)

**Analytics:** `GET /api/analytics/{client}`, `POST /api/analytics/{client}/refresh`,
`POST /api/analytics/{client}/insights`, `GET /api/analytics/clients` (lista do dim),
`POST /api/analytics/refresh-all` (só via API — invoca o Lambda analytics-compute
async para todos os clientes; body opcional `{inicio,fim}`. O refresh do dia-a-dia
é feito pelo botão "Atualizar" dentro do dashboard, por cliente).

**Agentes:** `POST /api/agents/{sherlock-codes,monk-lighthouse,yoda-kanban,harvey-closer}`.

**Auth:** `/api/auth/[...nextauth]`. **Outros:** `/api/upload`, `/api/analyze`.

---

## 10. Lambdas & Crons (EventBridge)

| Lambda | Cron | Função |
|--------|------|--------|
| `parquet-monthly-etl` | **diário, 02h UTC** | Converte raw → Parquet (mês corrente + anterior). Mantém o Parquet sempre atualizado — sem esperar virar o mês. Aceita `{targetMonth}` no payload para reprocessar um mês específico |
| `analytics-compute` | dia 1º, 04h UTC | Chama `/api/analytics/{alias}/refresh` de cada cliente (janela móvel 30d, ou período do payload) |
| `auditoria-compute` | domingo, 03h UTC | Valida todos os customizadores publicados (12 checks/produto) → `s3://.../\_auditoria/` |

Código em `lambda/`. Deploy via AWS CLI (profile `att-admin`) ou `deploy.sh`.

---

## 11. Clientes (18)

`c1` Escal · `c2` Estúdio Bola · `c3` Wentz · `c4` Minimal Design · `c5` RS Design ·
`c6` Tidelli · `c7` Hunter Douglas · `c8` Docol · `c9` Pedro Franco · `c10` DEXCO ·
`c11` WJ Luminárias · `c12` Christie · `c13` Cadeiras Rosa · `c14` Jader Almeida ·
`c15` Arctefacto · `c16` Green House · `c17` Persol · `c18` Riccó.

O `code` de cada cliente = alias minúsculo no Athena (ex: `estudiobola`, `wj`, `ricco`).
Mantido alinhado entre DynamoDB, `dim_client_alias` e o cache S3.

---

## 12. Workflow de Deploy (OBRIGATÓRIO via git)

```
1. Trabalhar na branch develop
2. npm run build  (validar que compila)
3. git add + commit (mensagem descritiva, Co-Authored-By)
4. git push origin develop
5. git checkout main && git merge develop --ff-only && git push origin main
6. Amplify auto-deploya a main (~4 min)
7. git checkout develop (voltar)
```

**Toda mudança de produção passa pelo git.** Operações de dados (reseed, reconcile,
import-orphans, refresh) são disparadas via endpoint após o deploy.

---

## 13. Pendências / Roadmap

- 🔴 Rotacionar chave AWS legada `AKIA47CRXRD2MWFO4FKS` (powerbi-athena-user) — adiado a pedido
- 🟡 Patch no JS do customizador (Verge3D): anexar `session_id` nas interações e/ou
  só contar sessão com interação (melhora qualidade da métrica na origem)
- 🟡 Planos/preços do portal ainda NÃO estão em prática comercial (são placeholder)
- 🟢 Migração Notion/Planner → portal: concluída (blocos/tickets/publicações migrados)
