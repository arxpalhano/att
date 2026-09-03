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

> Além do portal, o mesmo app hospeda o **ATT Instant** — funil público em
> `/experimentar` de geração 3D por IA (foto → modelo, self-service) + plano
> "Instant" em `/planos`. Arquivos: `src/app/experimentar/*`, `src/app/api/instant/*`,
> `src/components/Instant*.tsx`, `src/lib/instant-categorias.ts`.

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

10 tabelas, todas com chave `id` (string), PAY_PER_REQUEST, us-east-1:

| Tabela | Conteúdo |
|--------|----------|
| `att-clients` | Marcas (id `c1..c18`, code=alias Athena, contactEmail, active) |
| `att-contracts` | Contratos (clientId, totalBlocks, usedBlocks, startDate) |
| `att-blocks` | Produtos/blocos 3D (clientId, contractId, sku, csku, title, status, svc, pri) |
| `att-publications` | Publicações (blockId, url, embed, env, v) |
| `att-tickets` | Tickets de produção (clientId, blockId, title, status, slaDate, assignedTo) |
| `att-activities` | Log de atividades (blockId, userId, type, desc, at) |
| `att-users` | Usuários do portal (email, password, name, role, clientId) |
| `att-agent-routines` | Rotinas dos agentes automáticos (hoje só `argus-watchtower`: horários, destinatários, sites monitorados) |
| `att-agent-checks` | Histórico de verificações do Argus Watchtower (TTL 90 dias via `expiresAt`) |
| `att-bim-demands` | Demandas de blocos BIM para terceirizados (lote por marca: produtos, arquivos ArchiCAD/Revit/SketchUp, prazo, entrega, status) |

**Hidratação/persistência:** no mount, o Portal lê todas as tabelas via `/api/state/*`.
Se vazias, faz seed inicial (de `src/data/seed.ts` + `wj-seed.ts` + hardcoded).
Mudanças persistem com debounce de 800ms. Estado compartilhado entre admin e cliente.

**Status de bloco (`BlockStatus`):** draft, awaiting_client_files, client_files_under_review,
ready_to_start, in_modeling, **in_texturing**, awaiting_client_material_validation, approved_for_programming,
in_programming, internal_review, awaiting_client_final_validation, approved, **bim_conversion**, published,
blocked, on_hold, archived.

`in_texturing` (Em Texturização) e `bim_conversion` (Conversão BIM) entraram em 2026-09-02 para
espelhar o "Banco de Produtos" do Notion, onde são estágios com dezenas de produtos cada. Fluxo:
`in_modeling → in_texturing → validação material`; `approved → bim_conversion → published`
(e `published ↔ bim_conversion`, porque o BIM pode ser feito depois de publicar).

**Campos de bloco vindos do Notion (todos editáveis no "Editar bloco"):** `bim {skp,rvt,gsm}`
(arquivos BIM entregues), `modeler` (modelador, texto livre), e rastreabilidade `notionUrl`,
`notionCode`, `notionTech` (etapa que estava lá), `importedAt`.

---

### Regras de integridade do estado (desde 2026-09-02 — auditoria do dashboard)

**1. Tela nunca lê constante de seed.** `CLIENTS`, `CONTRACTS`, `USERS`, `TICKETS`
são variáveis de módulo espelhadas do estado por efeito (uma renderização atrás);
`ACTIVITIES`, `PUBLICATIONS` e `INITIAL_BLOCKS` são só o seed inicial e **nunca**
acompanham o app. Componente que precisa de dado lê do `AppContext`
(`blocks`, `activities`, `clients`, `contracts`, `publications`, `users`). Foi isso
que congelava o dashboard: "Atividade recente" mostrava o seed de março enquanto o
banco tinha movimentação de setembro.

**2. Aprovação pendente = status do bloco.** Não existe tabela de aprovações. Um
bloco em `awaiting_client_material_validation` ou `awaiting_client_final_validation`
É a aprovação pendente (`isAwaitingClient`). Aprovar/pedir revisão muda o status
(`APPROVAL_NEXT`: material → `approved_for_programming` / volta `in_modeling`;
final → `approved` / volta `internal_review`) e grava atividade
`approval_approved` / `approval_rejected`, que é o histórico das "resolvidas".
Dashboard, badge da sidebar, tela de Aprovações e aba do detalhe do bloco usam o
mesmo critério — por isso batem. Limite de 3 revisões (`MAX_CLIENT_REVISIONS`).

**3. Blocos usados de um contrato = contagem real.** `usedBlocksOf(contractId, blocks)`
em todos os pontos de leitura (dashboard do cliente, contratos, clientes, capacidade
no "Novo Bloco"). O campo `usedBlocks` gravado ficou como legado — ninguém o
atualiza ao criar/excluir bloco, e no formulário de contrato virou somente leitura.

**4. Hidratação nunca semeia por cima de erro.** O carregamento inicial só faz POST
do seed quando o GET respondeu OK com lista vazia. Com erro de rede/IAM, `hydrated`
fica `false` (efeitos de persistência não rodam) e um banner avisa que nada será
salvo. Antes, uma resposta `{error}` caía no "else" e fazia `replaceAll` do seed por
cima da tabela de produção.

**5. O portal não "ecoa" o que acabou de ler.** Os efeitos de persistência comparam o
estado com o retrato hidratado (`hydratedSnapshot`) e só gravam quando algo mudou de fato.
Antes, toda abertura do portal repostava as tabelas inteiras 800 ms após hidratar; como o
POST com array é `replaceAll`, quem abria a tela **durante** uma escrita externa (importação,
outro usuário) lia um retrato intermediário e o gravava por cima — foi assim que 98 blocos
da importação de 2026-09-02 sumiram e tiveram de ser regravados. Limitação que continua:
dois usuários editando a mesma tabela ao mesmo tempo ainda se sobrescrevem (último ganha);
resolver isso exige gravação por item, não por tabela.

**6. Card do dashboard abre a lista já filtrada.** `openBlocks(status)` guarda o
preset e navega; `BlocksListPage` monta com `initialStatus` (chave = status, então
remonta ao trocar). Sair de "Blocos" limpa o preset.

### Importação do Banco de Produtos do Notion (2026-09-02)

O "Banco de Produtos" (`Acompanhamento interno` no Notion, 723 produtos com etapa `Tech`,
checkboxes SKP/RVT/GSM, link do customizador e relação com o projeto/marca) foi importado
para `att-blocks`: **395 blocos novos** e **327 atualizados**; 2 clientes criados a partir
do Notion (**Dengo**, **Inkasa**) com contratos "Em definição"; 153 publicações criadas a
partir do "Link atual". Script, regras e checklist de revisão em `scripts/notion-import/`.
Regra-mãe: **nunca rebaixar bloco `published`** — 43 divergências ficaram registradas em
`notionTech` para a Jessica revisar no "Editar bloco". Backups pré-importação em
`s3://archtechtour-assets/backups/`.

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

### Permissão de telas por cliente (modo validação — desde 2026-08-12)

Enquanto o portal está sendo validado, **cliente entra vendo só o Analytics**.
Equipe interna não é afetada: qualquer papel diferente de `client` acessa tudo.

Como funciona (`Portal.tsx`, seção "PERMISSÕES DE PÁGINA"):

- `SeedUser.allowedPages?: string[]` — telas liberadas para aquele usuário.
  `["all"]` libera tudo. **Ausente ou vazio cai no padrão.**
- `PAGINAS_PADRAO_CLIENTE = ["analytics"]` — o padrão. É de propósito que o
  padrão seja restritivo: um cliente cadastrado hoje **já nasce restrito**, sem
  depender de alguém lembrar de marcar as telas. **Para liberar todo mundo
  depois da validação, troque essa constante para `["all"]`** — uma linha.
- A marcação no usuário vence o padrão (exceções caso a caso).
- A Jessica configura pela UI: **Usuários → Editar → "Telas liberadas"**, com
  um checkbox "Acesso total" e a lista de telas. A coluna *Acesso* na tabela
  mostra o que cada um enxerga, marcando quem está no `(padrão)`.

⚠️ **A trava fica no `renderPage`, não no menu.** Esconder o item do menu não
basta: o dashboard do cliente tem botões que chamam `setPage("blocks")` e
`setPage("contracts")` direto ([Portal.tsx:1165](src/components/Portal.tsx#L1165)
e outros), então o cliente chegaria na tela por dentro. O menu é filtrado só
pelo efeito visual. Telas de detalhe (`block_detail`, `contract_detail`) herdam
a permissão da listagem via `PAGINA_PAI`, e página desconhecida **falha
fechada**. Ao logar, o usuário cai na primeira tela permitida — senão um cliente
restrito abriria direto numa tela bloqueada, já que o padrão é `dashboard`.

### Cadastrar um cliente novo ponta a ponta (tudo pela UI, sem AWS CLI)

A PM faz sozinha — se algum passo exigir intervenção técnica, isso é bug de
produto, não tarefa de quem mantém o repo. Requer perfil **admin**.

1. **Clientes → Novo Cliente** — nome, `code` e e-mail de contato.
   O `code` deve ser igual ao alias do Athena (minúsculo, sem espaço/acento).
2. **Contratos → Novo Contrato** — escolhe o cliente e define *Total Blocos*.
   Sem contrato com folga não dá pra cadastrar produto (o bloco consome saldo).
3. **Usuários → Novo Usuário** — perfil *Cliente* + o cliente criado. Esse é o
   login com que a marca acessa o próprio portal.
4. **Analytics → "Gerenciar clientes" → Adicionar cliente** — alias + nome,
   grava no `dim_client_alias`. Depois **"Gerar"** na linha dele monta o
   dashboard. Sem este passo o cliente existe no portal mas fica sem analytics.

⚠️ O nome digitado no passo 4 vira a chave de tudo: o refresh filtra os eventos
por `cliente`, não por alias. Se divergir do que está no dim, o dashboard vem
vazio. O alias é o **prefixo do nome do produto** no customizador (`wj-enigma`
→ `wj`) — quando o produto não tem prefixo, o dono sai do `dim_produto_cliente`
(ver §7).

---

### BIM · Terceirizados (desde 2026-09-02)

Substitui o controle que a Jessica mantinha no Notion (`Equipe ATT / Freelance |
Serviços terceirizados / Controle terceirizados / <nome> / Demandas 2026`). O modelo
é o mesmo do Notion: uma **demanda** é um lote de produtos de uma marca enviado a um
terceirizado, com data do pedido, prazo, entrega e status
(`não iniciada → aguardando informação → em andamento → entregue → aprovada`).
Dentro dela, opcionalmente, a lista de produtos e, por produto, os arquivos a entregar
(ArchiCAD / Revit / SketchUp) — o nome de arquivo segue o padrão do Notion
(`Archicad-PoltronaCasuloNido`), gerado por `bimFileSlug`.

**Duas telas, dois perfis:**

| Tela | Quem vê | O que faz |
|---|---|---|
| **BIM · Terceirizados** (`bim`, sidebar interna) | equipe interna | KPIs (produtos em aberto, atrasadas, aguardando aprovação, entregues no mês), filtros por terceirizado/marca/status, criar/editar/excluir demanda (admin e operações), mudar status, **aprovar entrega**, ver valor por produto |
| **Minhas demandas** (`bim_minhas`) | perfil `freelancer_bim` | só as próprias demandas; marca arquivo a arquivo o que entregou, "Comecei", "Preciso de informação", "Marcar como entregue", observação para a equipe. **Não vê valor** e **não aprova** a própria entrega |

Perfil novo `freelancer_bim` ("Terceirizado BIM"): entra por e-mail/senha (não é
Microsoft), `paginasPermitidas` devolve só `["bim_minhas"]`, e ele **não aparece** como
responsável atribuível em tickets. Usuários criados: Danilo (`u_danilo`) e Raquel
(`u_raquel`), com as demandas de 2026 importadas do Notion (as de 2025 ficaram lá).

Tipos e helpers em `src/lib/bim.ts`; API `GET/POST /api/state/bim-demands`
(mesmo contrato das outras rotas de estado); estado hidratado/persistido com o resto
(`bimDemands` no `AppContext`). O dashboard interno tem o card "BIM com terceirizados"
(produtos em aberto + atrasadas), que abre a tela.

### Acabamentos (desde 2026-09-03)

Espelho do "Cadastro de Produtos - <Marca>" do Notion — onde o cliente diz o que vai em cada
parte do produto. Tabela `att-finishes` com dois tipos de registro (`src/lib/finishes.ts`):
**catálogo da marca** (`cat_<clientId>`: grupos como Tecidos / Madeiras / Pintura Metálica,
cada um com suas opções — cada marca tem os seus) e **cadastro do produto** (`blk_<blockId>`:
opções marcadas por grupo, variações, categoria, descrição da peça e "onde vai cada material").

| Onde | Quem | O que faz |
|---|---|---|
| Aba **Acabamentos** no detalhe do bloco | cliente e equipe | marca as opções de cada grupo (opção nova entra no catálogo ali mesmo), variações, textos; salva explicitamente |
| Tela **Acabamentos** (sidebar) | cliente vê a própria marca; equipe escolhe a marca | edita o catálogo (grupos/opções, sugestões prontas) e vê a situação por produto (Cadastrado / Pendente) com atalho para o bloco |

Importação inicial em 2026-09-03 a partir das bases do Notion (script e regras em
`scripts/notion-import/import_finishes.py`); registros importados têm `updatedBy: import-notion`
e `notionUrl`. Reimportar **não** sobrescreve o que foi editado no portal.

### Notificações (desde 2026-09-03)

O sino do cabeçalho é um menu **derivado do estado** (sem tabela), por perfil:
equipe — blocos aguardando cliente, bloqueados, tickets com SLA ≤ 3 dias ou sem responsável,
entregas BIM a aprovar, demandas BIM atrasadas ou com pedido de informação, movimentações
de outras pessoas nas últimas 24 h; cliente — blocos que esperam ação dele, produtos sem
acabamentos, publicações dos últimos 14 dias; terceirizado — demandas novas e atrasadas.
Contador de não lidas por usuário em `localStorage` (`att_notif_seen_<userId>`); abrir o menu
marca tudo como visto; clicar navega direto.

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

> 🔴 **Idempotência do ETL (bug corrigido em 2026-08-12).** `ALTER TABLE ... DROP
> PARTITION` remove SÓ o metadado no Glue — os arquivos `.parquet` continuam em
> `s3://archtechtour-assets/eventos-parquet/dt=YYYY-MM-DD/`. Como o `INSERT INTO`
> recria a partição no mesmo prefixo, os arquivos antigos voltavam a ser lidos
> junto com os novos: **cada execução diária somava uma cópia inteira do mês**
> (jun/2026 chegou a 35x, jul/2026 a 27x). Inflava tudo que usa `COUNT(*)` — Total
> de Eventos, Engajamento Real, Downloads, tempo total, eventos por produto.
> Visitantes Únicos e Carregamentos não foram afetados (`COUNT DISTINCT`).
> O `deleteMonthPrefixes()` da Lambda apaga os objetos S3 antes do drop/insert e
> **não pode ser removido**. Abril–agosto/2026 já reprocessados (todos em 1,0x).
> Para auditar: comparar `COUNT(*)` do `eventos_parquet` com o `eventos_customizador`
> no mesmo mês — têm que bater.

**Builder (`src/lib/analytics-builder.ts`):** 8 queries paralelas no Athena
(view `vw_eventos_base_com_cliente`, que mapeia alias→cliente via `dim_client_alias`).

**Filtro de bots (BOT_FILTER):** exclui Googlebot (UA "Nexus 5X Build/MMB29P"),
meta-externalads, facebookexternalhit, bingpreview, crawlers, headless, lighthouse,
pagespeed, monitores, e tráfego interno (localhost, explorar.archtechtour.com).

**Origens ocultas (ORIGENS_OCULTAS):** mapa `alias → domínios` no builder que remove
referrers específicos do gráfico "Origem de Acessos" (o tráfego continua contando nos
KPIs). Hoje: `tidelli → persolpersianas.com.br` — a Persol embedou o customizador da
Tidelli no site dela sem autorização, e o domínio poluía o dashboard da Tidelli.
Só some do gráfico depois de rodar o refresh do cliente (o dashboard lê o JSON do S3).

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

**`dim_client_alias`** (Athena, S3 `explorar.archtechtour.com/dim/dim_client_alias/`):
mapeia alias→nome do cliente. Para adicionar cliente novo ao analytics, incluir
linha aqui (CSV com header, `skip.header.line.count=1`). ⚠️ Cada arquivo no prefixo
precisa do seu próprio header, e **um alias não pode aparecer duas vezes** — o
LEFT JOIN da view duplicaria os eventos.

Um mesmo cliente PODE ter vários aliases (`jader` e `jaderalmeida` são ambos
Jader Almeida), porque os customizadores nomeiam o produto de formas diferentes.
Os dois geram números idênticos — o refresh filtra por `cliente`, não por alias —
então `/api/analytics/clients` deduplica por nome de cliente antes de listar,
senão a PM veria o mesmo cliente duas vezes.

**`dim_produto_cliente`** (S3 `explorar.archtechtour.com/dim/dim_produto_cliente/`):
mapa **produto→cliente**, criado em 2026-08-12. Existe porque o campo `produto` vem
de um atributo no HTML de cada customizador, preenchido à mão, e muitos não têm o
prefixo do cliente — `"Cadeira Office Soul"` (Escal) virava o cliente `"cadeira"`.
Prefixo genérico não dá pra resolver por alias: *Cadeira Office Soul* é da Escal e
*Cadeira Olive* é do Jader. A verdade vem da URL das publicações
(`.../{pasta-do-cliente}/ver-N/{slug-do-produto}/`). Isso devolveu **6.137 eventos**
aos donos certos, ~5.100 só da Escal (+67% no dashboard dela).
Regenerar com `scripts/gerar-dim-produto-cliente.py` sempre que entrarem
publicações de produtos sem prefixo.

**Ordem de resolução do cliente na `vw_eventos_base_com_cliente`:**
```sql
COALESCE(d.cliente, p.cliente, LOWER(alias))
      -- ^dim_client_alias (prefixo)
                 -- ^dim_produto_cliente (produto inteiro)
                             -- ^fallback: vira "lixo" e some dos dashboards
```
O alias vem primeiro **de propósito**: quem já resolvia pelo prefixo continua
idêntico, e o dim de produto só entra como resgate. A mudança é estritamente
aditiva — nenhum cliente perde evento. Ao mexer na view, validar que o
`COUNT(*)` total por período não muda.

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
| 🔵 **Argus Watchtower** | Argus Panoptes (o de cem olhos) | Monitor de disponibilidade: verifica nos horários da rotina (padrão **13h e 21h**, Brasília) se os sites da ATT estão no ar e manda e-mail pra equipe. **Não usa Claude** — é probe HTTP puro. Rotina editável na própria tela. |

**Regra de contexto:** agentes NUNCA inventam números/preços. Usam só dados reais do
dashboard/dossiê. Fonte de verdade institucional = archtechtour.com.

### Argus Watchtower — monitor de disponibilidade (desde 2026-08-24)

Único agente que roda **sozinho**, sem ninguém abrir o portal. Quem executa é a Lambda
`site-watchdog` (ver §10), não o Next.js — assim o monitoramento sobrevive a uma queda
do próprio `app.archtechtour.com`.

**Rotina padrão:** 13h e 21h (Brasília) · e-mail para `info@archtechtour.com` e
`palhano@arx.hk` · alvo `https://archtechtour.com` · avisa sempre (OK e falha).

**Tudo é editável na tela do agente** (Agentes AI → Argus Watchtower), e salvar já vale
para a próxima hora — a rotina mora no DynamoDB e a Lambda relê a cada execução:
horários (chips de 00h a 23h), destinatários, sites monitorados (com texto opcional que
precisa existir na página — pega "site no ar mas quebrado"), avisar sempre × só em falha,
timeout, tentativas extras, remetente, e liga/desliga geral.

A tela mostra ainda a última verificação, a próxima automática, e o histórico de 90 dias.
Os botões **"Verificar sem e-mail"** e **"Verificar e enviar e-mail"** rodam na hora
(esses passam pelo Next.js, não pela Lambda).

**Anti-falso-positivo:** cada alvo é testado com `retries` tentativas espaçadas em 5s
antes de ser declarado fora do ar. **Anti-duplicidade:** a Lambda grava um lock
idempotente por slot (`argus-watchtower#YYYY-MM-DDTHH`), então redisparo do EventBridge
não gera e-mail repetido.

**E-mail (SES, us-east-1):** remetente `monitor@archtechtour.com` (identidade de domínio
`archtechtour.com`). ⚠️ A conta SES está em **sandbox** — só envia para destinatários
verificados. Hoje: todo `@archtechtour.com` (pelo domínio) + `palhano@arx.hk`. Para um
destinatário novo fora do domínio, verificar antes:
`aws sesv2 create-email-identity --email-identity NOVO@dominio.com --region us-east-1 --profile att-admin`
(a pessoa clica no link que a AWS envia) — ou pedir production access no console do SES.

---

## 9. Endpoints da API

**Estado (DynamoDB):** `GET/POST /api/state/{blocks,tickets,activities,clients,contracts,publications,users,bim-demands}`
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

**Argus Watchtower:** `GET /api/agents/argus-watchtower` (rotina + histórico),
`POST /api/agents/argus-watchtower` (verifica agora; body `{sendEmail?: boolean}`),
`GET/PUT /api/agents/argus-watchtower/routine` (rotina editável).

**Auth:** `/api/auth/[...nextauth]`. **Outros:** `/api/upload`, `/api/analyze`.

---

## 10. Lambdas & Crons (EventBridge)

| Lambda | Cron | Função |
|--------|------|--------|
| `parquet-monthly-etl` | **diário, 02h UTC** | Converte raw → Parquet (mês corrente + anterior). Apaga os objetos S3 da partição antes de reinserir (idempotência — ver ⚠️ em §7). Mantém o Parquet sempre atualizado, sem esperar virar o mês. Aceita `{targetMonth}` ou `{targetMonths:[...]}` no payload para reprocessar meses específicos. Timeout 900s / 1024MB |
| `analytics-compute` | dia 1º, 04h UTC | Chama `/api/analytics/{alias}/refresh` de cada cliente (janela móvel 30d, ou período do payload) |
| `auditoria-compute` | domingo, 03h UTC | Valida todos os customizadores publicados (12 checks/produto) → `s3://.../\_auditoria/` |
| `site-watchdog` | **de hora em hora** (`cron(0 * * * ? *)`, rule `site-watchdog-hourly`) | Agente Argus Watchtower. Acorda toda hora, lê a rotina em `att-agent-routines` e só age se a hora atual (America/Sao_Paulo) estiver na lista — é isso que deixa os horários editáveis pelo portal sem redeploy. Testa as URLs, manda e-mail via SES e grava o histórico. Role própria: `lambda-site-watchdog-role`. Timeout 120s / 256MB |

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

### Reportado pela Jessica (PM) em 2026-08-11 — correção por etapas

1. ✅ **Números inflados** (WJ 234.685 eventos, Riccó acima dos outros meses) —
   era a duplicação do ETL. Corrigido e reprocessado em 2026-08-12 (ver §7).
2. ✅ **"Erro desconhecido"** ao trocar o período — era o fallback de resposta
   não-JSON (timeout do gateway devolvendo HTML), causado pela duplicação do
   Parquet: as 8 queries varriam ~27x mais dados. Com o item 1 corrigido, o
   refresh de 30 dias da Riccó leva 6s e o de 1 ano da WJ leva 8s. A mensagem
   agora distingue 502/504 e sugere um período menor.
3. ✅ **Vazamento Persol↔Tidelli** — causa raiz achada: a página
   `persolpersianas.com.br/produtos/cortinas/cortina-rolo` embeda o customizador
   `explorar.archtechtour.com/tidelli/ver-5/cadeira-com-braco-caraiva/`. Embed
   errado no site da Persol (16 eventos desde junho). **Correção é no site da
   Persol**, não no nosso código.
   O link errado não é um iframe: fica na caixa **"Instaladores"**, no link
   **"Manual de instação Rolô"** (typo do site deles) — visualmente é só mais um
   link de download, só dá pra notar clicando. Na mesma página o link
   `Bloco3D → v3d.net/1f6g` está correto, então foi erro de cópia só nesse.

   Junto veio o problema maior dos produtos sem prefixo, resolvido pelo
   `dim_produto_cliente` (ver §7). **Dengo Petlovers** era cliente de verdade sem
   alias no dim — adicionado (`dengo`), recuperando 3.931 eventos / 3.051 sessões
   desde ago/2025. **Ainda sem dono** (precisam de resposta da Jessica): `<!`
   (562 ev — embed quebrado em `estudiobola.com` + tráfego interno de
   `marketing.archtechtour.com` e do editor do RD Station), `persiana` (100 ev —
   Persol ou Hunter Douglas?), `naiade` (40), `inkasa` (33), e produtos que não
   estão em `att-publications` (`cadeira` 194, `mesa` 175, `puff` 150, `estante` 54,
   `banqueta` 35, `banco` 7).
4. ✅ **Contratos não editáveis** — não era bug, era permissão. `canEdit` em
   Contratos, Clientes e Publicações é `role === "admin"`, e a Jessica era
   `internal_ops` no seed (`u6`), então o botão de editar nem era renderizado.
   O login SSO só promove a admin quem **não** está no seed (`Portal.tsx`,
   LoginPage) — quem está, herda o papel de lá. Jessica promovida a admin no
   seed **e** no DynamoDB (mudar só o seed não adianta: a hidratação sobrescreve
   com o que vier do banco). Os contadores `usedBlocks` foram auditados e batem
   com a contagem real de blocos nos 18 contratos — nenhuma divergência. O que
   ela precisa é aumentar `totalBlocks`, porque vários contratos estão em
   capacidade máxima (Estúdio Bola 107/107, Cadeiras Rosa 11/11, Riccó 38/38,
   RS Design 13/13).
5. ✅ **Usuários criados somem** — `UsersPage` usava `useState` local em vez do
   estado do `AppContext`, então o efeito de persistência nunca disparava e nada
   chegava ao DynamoDB (confirmado: `att-users` tinha só os 25 do seed).
   Corrigido; a página passa a consumir `users/setUsers` do contexto.
   ⚠️ Risco conhecido que continua de pé: o persist manda o array inteiro
   (`replaceAll`), então duas abas/admins editando ao mesmo tempo = o último
   sobrescreve o outro.
