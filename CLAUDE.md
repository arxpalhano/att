# CLAUDE.md — Orientação para o Claude Code neste repositório

> Leia este arquivo primeiro. Ele te orienta em 2 minutos. Para o detalhe
> completo da arquitetura, leia **`PORTAL.md`** (fonte de verdade).

---

## O que é este repositório

Repo `arxpalhano/att` — a plataforma web da **ArchTechTour** (ATT), empresa que
transforma catálogos de marcas de móveis/design em **customizadores 3D interativos
com Realidade Aumentada**, usados por arquitetos para especificar produtos.

Contém **dois produtos** no mesmo app Next.js 14 (App Router, SSR no AWS Amplify):

1. **Portal de gestão + cliente** — pipeline de produção 3D, dashboards de analytics,
   4 agentes de IA, CRUD de clientes/contratos/blocos/publicações. É o grosso do repo.
   → Documentado por completo em **`PORTAL.md`**.
2. **ATT Instant** (adicionado depois) — funil público em `/experimentar` de geração
   3D por IA (foto → modelo 3D self-service) + plano "Instant" em `/planos`.
   Arquivos: `src/app/experimentar/*`, `src/app/api/instant/*`,
   `src/components/InstantWizard.tsx`, `InstantResultado.tsx`, `src/lib/instant-categorias.ts`.

---

## ⚠️ Regras que NÃO se quebram

1. **Todo deploy passa pelo git.** O Amplify auto-deploya a branch `main`. Fluxo:
   ```
   branch develop → npm run build → commit → push develop
   → git checkout main && git merge develop --ff-only && git push main
   → Amplify deploya (~4 min) → git checkout develop
   ```
2. **Nunca inventar dados.** Números de analytics vêm SÓ do Athena (reais). Não há
   dados fictícios no dashboard. Planos/preços do portal ainda não estão em prática
   comercial. Fonte de verdade institucional = archtechtour.com.
   Única exceção: o cliente **"ArchTechTour"** (alias `archtechtour`) no seletor de
   analytics é um dashboard de **demonstração** com números fictícios, usado em
   vídeos comerciais — `src/lib/analytics-demo.ts`, isolado dos clientes reais
   (PORTAL.md §7).
3. **Env vars do Amplify SSR** precisam estar em `next.config.js` (`env: {...}`) —
   o Amplify SSR Lambda NÃO injeta env vars em runtime; só o que estiver ali chega.

---

## Stack & onde as coisas estão

- **Frontend/Backend:** Next.js 14 App Router, um único app. UI principal em
  `src/components/Portal.tsx` (arquivo grande — clientes, blocos, tickets, agentes).
- **Estado persistente:** DynamoDB (us-east-1), 12 tabelas `att-*`. APIs em
  `src/app/api/state/*` (geradas por `stateRoute()` em `src/lib/activity-server.ts`).
  Hidrata no mount, persiste com debounce **por delta** (`{upsert, delete}`), nunca a
  tabela inteira.
- **Log de atividades (auditoria de uso):** gravado SÓ pelo servidor ao aplicar o delta
  (`describeChange` em `src/lib/activity.ts`) + `POST /api/activity` para login/logout/
  tela aberta/upload/agentes/analytics (`logActivity` em `src/lib/activity-client.ts`).
  Tela "Atividade" mostra uso por pessoa. Não criar `setActivities([...])` no browser —
  o servidor já descreve a mudança. PORTAL.md §6 "Atividade".
- **Analytics:** AWS Athena (`customizador_events`). Builder em
  `src/lib/analytics-builder.ts` (com filtro de bots). Dashboard em
  `src/components/AnalyticsDashboard.tsx`.
- **Agentes IA:** `src/app/api/agents/{sherlock-codes,monk-lighthouse,yoda-kanban,harvey-closer}`.
  Contexto compartilhado em `src/lib/agent-context.ts`. Retry em `src/lib/claude-retry.ts`.
  **Argus Watchtower** (monitor de uptime) é o único que roda sozinho e sem Claude:
  `src/lib/watchdog.ts` + `lambda/site-watchdog` — ver PORTAL.md §8.
- **Lambdas:** `lambda/{parquet-monthly-etl,analytics-compute,auditoria-compute,site-watchdog}`.
- **Auth:** NextAuth + Microsoft Entra em `src/app/api/auth/[...nextauth]`.
- **i18n:** `src/lib/i18n.tsx` (PT/EN/ES/FR).
- **Seed de dados:** `src/data/seed.ts` + `src/data/wj-seed.ts`.

---

## Operações AWS (CLI)

- **Profile:** `att-admin` (admin). Ex: `aws dynamodb scan --table-name att-blocks --region us-east-1 --profile att-admin`.
- **Amplify app id:** `d20t94dp8646px` (branch main, região sa-east-1). Domínio: `app.archtechtour.com`.
- **Endpoints de manutenção** (rodar via `curl -X POST` após deploy):
  `/api/state/reseed`, `/api/state/reconcile-publications`, `/api/state/import-orphans`,
  `/api/analytics/{alias}/refresh`, `/api/analytics/refresh-all`.
- **Athena:** dados em `eventos_parquet` (particionado). Eventos crus em
  `eventos_customizador`. Mapa cliente↔alias em `dim_client_alias` (S3
  `explorar.archtechtour.com/dim/`). Para adicionar cliente ao analytics, incluir
  linha no dim.

---

## Estado atual / onde paramos

Portal em produção, funcional. Resumo do que foi construído (ordem cronológica em PORTAL.md):
- ✅ Deploy Amplify + domínio `app.archtechtour.com` + SSO Microsoft + i18n (4 idiomas)
- ✅ Migração Notion/Planner → portal (18 clientes, blocos, tickets, publicações no DynamoDB)
- ✅ Analytics real do Athena com filtro de bots + métrica "Engajamento Real" + insights IA
- ✅ 5 agentes na aba "Agentes AI" (admin): Sherlock/Monk/Yoda/Harvey (IA) + Argus Watchtower
  (monitor de uptime: checa os sites 13h/21h e avisa por e-mail; rotina editável na tela)
- ✅ CRUD completo admin: clientes, contratos, blocos (criar/editar/**excluir**), publicações, usuários
- ✅ Pipeline analytics robusto: parquet ETL **diário** (mês corrente+anterior),
  analytics-compute dia 1º. Resolveu dashboards zerados.
- ✅ ATT Instant: funil `/experimentar` (foto→3D IA) + plano Instant
- ✅ BIM · Terceirizados: demandas de blocos ArchiCAD/Revit para Danilo e Raquel (perfil
  `freelancer_bim`, tela própria só com as demandas deles) — espelho do Notion. PORTAL.md §6
- ✅ Log de atividades confiável (2026-09-09): servidor registra toda gravação de estado
  + login/logout/telas/upload/agentes/analytics; tela Atividade com uso por pessoa, filtros
  e CSV; exclusões passaram a apagar no banco (bug do replaceAll). PORTAL.md §6
- ✅ Base de Conhecimento (`kb`): bases Comercial/Marketing/Tech/TI liberadas por perfil ou
  pessoa, artigos em Markdown com anexos no S3 (`kb/`). Base de TI já preenchida com todo o
  contexto técnico (portal, AWS, site WordPress, Instant, repos). `src/lib/kb.ts`,
  `src/components/KnowledgeBase.tsx`, `src/data/kb-seed.ts`. PORTAL.md §6

**Feedbacks recentes da Jessica (PM) — todos atendidos:** Arctefacto removido dos
dashboards; dashboards zerados corrigidos (era o parquet ETL); bloco editável+excluível;
filtro de marca nas publicações.

**Pendências abertas** (ver `PORTAL.md §13`):
- 🟠 Rodar `scripts/kb-infra.sh` (IAM da `att-kb` + CORS do bucket) — sem isso a KB não carrega em produção
- 🔴 Rotacionar chave AWS legada `AKIA47CRXRD2MWFO4FKS` (adiado a pedido do dono)
- 🟡 Patch no JS do customizador (Verge3D): anexar `session_id` nas interações
  (hoje AR/download/whatsapp não têm session_id — só o `session_start` tem)

---

## Documentação neste repo (o que confiar)

| Arquivo | Status |
|---------|--------|
| **`PORTAL.md`** | ✅ Fonte de verdade — arquitetura completa e atual |
| **`CLAUDE.md`** | ✅ Este arquivo — orientação de entrada |
| `MANUAL_TECNICO.md` | ⚠️ Parcialmente desatualizado (pré-migração) — usar PORTAL.md |
| `README.md` | ⚠️ Desatualizado (clientes/seed antigos) |
| `PENDENTE.md` | ⚠️ Desatualizado (URL/clientes antigos) — pendências reais em PORTAL.md §13 |
| `DEPLOY_AMPLIFY.md` | Referência de deploy inicial |

Ao terminar mudanças relevantes, **atualize `PORTAL.md`** e commite junto.
