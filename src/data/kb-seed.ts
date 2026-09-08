/**
 * Seed inicial da Base de Conhecimento. Só entra quando a tabela `att-kb`
 * está vazia (mesma regra das outras tabelas: nunca por cima de dado real).
 *
 * As bases Comercial, Marketing e Tech nascem com a estrutura (seções) e um
 * artigo-guia — o conteúdo é da equipe, não inventamos. A Base de TI já vem
 * preenchida com o contexto técnico documentado em PORTAL.md / CLAUDE.md.
 *
 * ⚠️ Nada de segredo aqui: sem senhas, chaves, tokens ou IDs de credencial.
 */
import { KbArticle, KbAttachment, KbBase, KbRecord } from "@/lib/kb";

const T0 = "2026-09-08T12:00:00.000Z";
const BY = "seed";

const base = (b: Omit<KbBase, "kind" | "createdAt" | "updatedAt" | "updatedBy">): KbBase => ({
  kind: "base", createdAt: T0, updatedAt: T0, updatedBy: BY, ...b,
});

const article = (
  id: string, baseId: string, section: string, order: number, title: string, body: string, tags: string[] = [],
): KbArticle => ({
  id, kind: "article", baseId, section, order, title, body: body.trim(), tags, attachments: [],
  createdAt: T0, updatedAt: T0, updatedBy: BY,
});

// ------------------------------------------------------------
// BASES
// ------------------------------------------------------------
export const KB_SEED_BASES: KbBase[] = [
  base({
    id: "kb_comercial", name: "Base Comercial", order: 1, icon: "briefcase", color: "emerald",
    description: "Como vendemos: proposta de valor, planos, propostas, objeções e materiais de venda.",
    access: { roles: ["admin", "internal_ops"], userIds: [] },
    editors: { roles: ["admin", "internal_ops"], userIds: [] },
  }),
  base({
    id: "kb_marketing", name: "Base de Marketing", order: 2, icon: "megaphone", color: "rose",
    description: "Passo a passo das ações, ferramentas que usamos e a identidade visual da ArchTechTour.",
    access: { roles: ["admin", "internal_ops"], userIds: [] },
    editors: { roles: ["admin", "internal_ops"], userIds: [] },
  }),
  base({
    id: "kb_tech", name: "Base Tech", order: 3, icon: "cpu", color: "violet",
    description: "Produção 3D: modelagem de produto, texturização, programação do customizador, AR e BIM.",
    access: { roles: ["admin", "internal_modeling", "internal_programming", "internal_ops"], userIds: [] },
    editors: { roles: ["admin", "internal_modeling", "internal_programming"], userIds: [] },
  }),
  base({
    id: "kb_ti", name: "Base de TI", order: 4, icon: "server", color: "sky",
    description: "Todo o contexto de tecnologia: site, portal, infraestrutura AWS, deploy, dados, agentes e operação.",
    access: { roles: ["admin", "internal_programming"], userIds: [] },
    editors: { roles: ["admin", "internal_programming"], userIds: [] },
  }),
];

// ------------------------------------------------------------
// ARTIGOS — bases da equipe (estrutura + guia; conteúdo é da equipe)
// ------------------------------------------------------------
const GUIA_BASE = (nome: string, secoes: string[]) => `
Esta é a **${nome}**. Ela começa com a estrutura abaixo — cada item é uma **seção**, e dentro de cada seção entram os artigos.

${secoes.map((s) => `- ${s}`).join("\n")}

## Como usar

- **Novo artigo** cria um texto dentro de uma seção (escolha uma existente ou digite uma nova).
- O corpo aceita **Markdown**: títulos com \`#\`, listas com \`-\`, negrito com \`**texto**\`, links com \`[nome](url)\`, código com crases e tabelas com \`|\`.
- **Anexos** (PDF, imagens, planilhas, apresentações, arquivos de design…) ficam no rodapé de cada artigo.
- Quem vê e quem edita esta base é definido pelo admin em **Configurar base** (por perfil ou por pessoa).

> Substitua este artigo quando a base tiver conteúdo próprio.
`;

const ARTIGOS_EQUIPE: KbArticle[] = [
  article("ka_comercial_guia", "kb_comercial", "Início", 0, "Como está organizada a Base Comercial",
    GUIA_BASE("Base Comercial", ["Proposta de valor e pitch", "Planos e precificação", "Propostas e contratos", "Objeções frequentes", "Cases e referências", "Materiais de apoio"]),
    ["guia"]),
  article("ka_marketing_guia", "kb_marketing", "Início", 0, "Como está organizada a Base de Marketing",
    GUIA_BASE("Base de Marketing", ["Passo a passo das ações", "Ferramentas", "Identidade visual", "Redes sociais e conteúdo", "Site e landing pages", "Eventos e parcerias"]),
    ["guia"]),
  article("ka_marketing_identidade", "kb_marketing", "Identidade visual", 1, "Identidade visual da ArchTechTour",
    `
Guarde aqui o **manual da marca** e os arquivos oficiais. Sugestão de estrutura:

## Logotipo
- Versões (principal, reduzida, monocromática) e áreas de respiro
- Anexar os arquivos vetoriais (AI/SVG/PDF) e PNG em fundo transparente

## Cores
- Paleta principal e secundária, com códigos HEX/RGB/CMYK

## Tipografia
- Famílias tipográficas, pesos e onde cada uma é usada

## Aplicações
- Apresentações, assinatura de e-mail, redes sociais, materiais impressos

> Os anexos deste artigo são a fonte oficial dos arquivos de marca.
`,
    ["marca", "identidade"]),
  article("ka_marketing_ferramentas", "kb_marketing", "Ferramentas", 2, "Ferramentas que usamos",
    `
Liste aqui cada ferramenta com **para que serve**, **quem tem acesso** e **onde está o login** (nunca a senha).

| Ferramenta | Para quê | Responsável |
|---|---|---|
| (preencher) | | |
`,
    ["ferramentas"]),
  article("ka_tech_guia", "kb_tech", "Início", 0, "Como está organizada a Base Tech",
    GUIA_BASE("Base Tech", ["Modelagem de produto", "Texturização e materiais", "Programação do customizador (Verge3D)", "Realidade Aumentada", "Blocos BIM (ArchiCAD / Revit / SketchUp)", "Checklist de qualidade e publicação"]),
    ["guia"]),
  article("ka_tech_fluxo", "kb_tech", "Modelagem de produto", 1, "Fluxo de produção de um bloco",
    `
Etapas pelas quais um produto passa no portal (status do bloco):

1. **Rascunho** → **Aguardando arquivos do cliente** → **Arquivos em revisão**
2. **Pronto para iniciar** → **Em modelagem** → **Em texturização**
3. **Aguardando validação de material** (cliente aprova ou pede revisão — até 3 revisões)
4. **Aprovado para programação** → **Em programação** → **Revisão interna**
5. **Aguardando validação final** → **Aprovado** → **Conversão BIM** → **Publicado**

Documente aqui, por etapa, os padrões técnicos (escala, unidades, nomenclatura de arquivos, limites de polígonos, texturas) — hoje esse conhecimento está com a equipe de modelagem e programação.
`,
    ["fluxo", "modelagem"]),
];

// ------------------------------------------------------------
// ARTIGOS — Base de TI (contexto técnico real, de PORTAL.md / CLAUDE.md)
// ------------------------------------------------------------
const TI = "kb_ti";
const ARTIGOS_TI: KbArticle[] = [
  article("ka_ti_visao", TI, "Visão geral", 0, "Mapa da tecnologia da ArchTechTour",
    `
A ArchTechTour transforma catálogos de marcas de móveis/design em **customizadores 3D interativos com Realidade Aumentada**, usados por arquitetos para especificar produtos. Tudo que é tecnologia está listado aqui.

## Sites e domínios
| Endereço | O que é |
|---|---|
| archtechtour.com | Site institucional — **fonte de verdade institucional** |
| app.archtechtour.com | Portal (gestão interna + área do cliente) — AWS Amplify |
| explorar.archtechtour.com | Customizadores publicados (bucket S3, um caminho por produto/versão) |
| marketing.archtechtour.com | Páginas de marketing (RD Station) |

## Repositório
- GitHub \`arxpalhano/att\` — um único app **Next.js 14 (App Router, SSR)** com dois produtos:
  1. **Portal de gestão + cliente** — pipeline de produção 3D, analytics, agentes de IA, CRUD de clientes/contratos/blocos/publicações, BIM terceirizados, acabamentos e esta Base de Conhecimento.
  2. **ATT Instant** — funil público em \`/experimentar\` (foto → modelo 3D por IA, self-service) e plano "Instant" em \`/planos\`.
- Documentação no repo: \`CLAUDE.md\` (orientação rápida) e \`PORTAL.md\` (arquitetura completa — fonte de verdade). \`MANUAL_TECNICO.md\`, \`README.md\` e \`PENDENTE.md\` estão desatualizados.

## Regras que não se quebram
1. **Todo deploy passa pelo git.** O Amplify publica a branch \`main\` automaticamente.
2. **Nunca inventar dados.** Números de analytics vêm só do Athena (reais). Planos/preços do portal ainda não estão em prática comercial.
3. **Env vars do Amplify SSR** precisam estar no \`env\` do \`next.config.js\` — a Lambda SSR não recebe variáveis em runtime.
`,
    ["visão geral", "domínios", "repositório"]),

  article("ka_ti_stack", TI, "Infraestrutura", 1, "Stack e infraestrutura AWS",
    `
| Camada | Tecnologia |
|---|---|
| Framework | Next.js 14 (App Router, SSR), React 18, Tailwind |
| Hospedagem | AWS Amplify Hosting (SSR em Lambda, região **sa-east-1**) — app id \`d20t94dp8646px\`, branch \`main\` |
| Banco de estado | DynamoDB (**us-east-1**, PAY_PER_REQUEST), tabelas \`att-*\` |
| Analytics | AWS Athena (DB \`customizador_events\`, us-east-1) |
| Storage | S3 \`explorar.archtechtour.com\` (customizadores, dims) e \`archtechtour-assets\` (cache de analytics, uploads, anexos da KB, backups) |
| E-mail | SES us-east-1, remetente \`monitor@archtechtour.com\` (conta em **sandbox** — só envia para destinatários verificados) |
| Auth | NextAuth + Microsoft Entra (Azure AD) SSO + login local |
| IA | Claude (Haiku 4.5 com fallback Sonnet) via \`@anthropic-ai/sdk\` |

## Conta e acesso
- Conta AWS \`891377125620\`. Perfil de CLI da equipe técnica: \`att-admin\` (ex.: \`aws dynamodb scan --table-name att-blocks --region us-east-1 --profile att-admin\`).
- **IAM Role do SSR:** \`amplify-archtechtour-portal-ssr\`, com políticas inline: \`DynamoDBPortalAccess\` (lista explícita das tabelas + SES), \`archtechtour-portal-athena-s3\` (Athena, Glue, S3 dos buckets), \`ATTInstantPortal\` (prefixo \`_instant/\`), \`InvokeAnalyticsCompute\`, \`S3ExplorarRead\`.
- ⚠️ Tabela nova no DynamoDB **precisa entrar na lista** do \`DynamoDBPortalAccess\` — senão o portal recebe AccessDenied.
- Credenciais no Amplify: a Lambda expõe um listener de credenciais; \`src/lib/amplify-credentials.ts\` aponta \`AWS_CONTAINER_CREDENTIALS_FULL_URI\` para ele. Chamar \`bootstrapAmplifyCredentials()\` no topo de toda rota que usa AWS.
- Clients AWS são criados por chamada (\`src/lib/aws-clients.ts\`) — sem singleton, porque o processo Node persiste entre requests e pode segurar credencial expirada.

## Variáveis de ambiente (next.config.js → env)
\`NEXTAUTH_URL\`, \`NEXTAUTH_SECRET\`, \`AZURE_AD_CLIENT_ID/SECRET/TENANT_ID\`, \`APP_AWS_REGION\`, \`ATHENA_DB/WORKGROUP/OUTPUT\`, \`ANTHROPIC_API_KEY\`. Valores ficam no console do Amplify (nunca no repo).
`,
    ["aws", "amplify", "iam", "stack"]),

  article("ka_ti_deploy", TI, "Infraestrutura", 2, "Deploy (obrigatório via git)",
    `
O Amplify observa a branch \`main\` e publica sozinho (~4 min). Fluxo:

\`\`\`
1. Trabalhar na branch develop
2. npm run build            (validar que compila)
3. git add + commit         (mensagem descritiva)
4. git push origin develop
5. git checkout main && git merge develop --ff-only && git push origin main
6. Amplify auto-deploya a main
7. git checkout develop     (voltar)
\`\`\`

- **Toda mudança de produção passa pelo git.** Nada é editado direto no console.
- Operações de dados (reseed, reconcile, import-orphans, refresh) são disparadas por endpoint **depois** do deploy (ver "Endpoints de manutenção").
- Ao terminar mudanças relevantes, atualizar \`PORTAL.md\` e commitar junto.
- Lambdas (\`lambda/*\`) têm deploy próprio via AWS CLI (\`deploy.sh\` em cada pasta).
`,
    ["deploy", "git", "amplify"]),

  article("ka_ti_auth", TI, "Portal", 3, "Autenticação e perfis de usuário",
    `
## Como se entra
- **Microsoft SSO** (\`/api/auth/[...nextauth]\`, provider Azure AD). App Registration no Entra; redirect \`/api/auth/callback/azure-ad\`. Conta \`@archtechtour.com\` que **não** está cadastrada entra como admin; quem está cadastrado herda o perfil do cadastro.
- **Login local** (e-mail + senha, tabela \`att-users\`): clientes, equipe e terceirizados.

## Perfis
| Perfil | Quem | O que vê |
|---|---|---|
| \`admin\` | direção / PM | tudo, inclusive Agentes AI e configuração da KB |
| \`internal_ops\` | operações / financeiro | pipeline completo |
| \`internal_modeling\` | modeladores | pipeline completo |
| \`internal_programming\` | devs | pipeline completo |
| \`client\` | marcas | por padrão **só Analytics** (modo validação); telas extras liberadas em Usuários → Editar → "Telas liberadas" |
| \`freelancer_bim\` | terceirizados BIM | só "Minhas demandas" |

A trava de acesso fica no \`renderPage\` do \`Portal.tsx\`, não no menu — esconder o item não basta. Telas de detalhe herdam a permissão da listagem. A **Base de Conhecimento** tem controle próprio por base (perfis e/ou usuários), independente das telas.
`,
    ["auth", "sso", "perfis", "permissões"]),

  article("ka_ti_dados", TI, "Portal", 4, "Modelo de dados (DynamoDB)",
    `
Todas as tabelas têm chave \`id\` (string), PAY_PER_REQUEST, us-east-1.

| Tabela | Conteúdo |
|---|---|
| \`att-clients\` | Marcas (\`code\` = alias do Athena, contactEmail, active) |
| \`att-contracts\` | Contratos (clientId, totalBlocks, startDate) |
| \`att-blocks\` | Produtos/blocos 3D (status, sku, svc, pri, bim, modeler, rastreio do Notion) |
| \`att-publications\` | Publicações (blockId, url, embed, env, v) |
| \`att-tickets\` | Tickets de produção (status, slaDate, assignedTo) |
| \`att-activities\` | Log de atividades |
| \`att-users\` | Usuários do portal (email, senha, role, clientId, allowedPages) |
| \`att-agent-routines\` / \`att-agent-checks\` | Rotina e histórico do Argus Watchtower (TTL 90 dias) |
| \`att-bim-demands\` | Demandas BIM para terceirizados |
| \`att-finishes\` | Catálogo de acabamentos por marca + cadastro por produto |
| \`att-kb\` | Base de Conhecimento (bases e artigos) |

## Como o portal persiste
- No mount, o portal lê todas as tabelas via \`/api/state/*\`. Se uma vier **vazia com GET OK**, semeia (\`src/data/seed.ts\`, \`wj-seed.ts\`, \`kb-seed.ts\`). Com erro, não escreve nada e mostra um banner.
- Mudanças persistem com debounce de 800 ms, e só se o estado mudou em relação ao retrato hidratado — o POST com array é \`replaceAll\` (BatchWrite), então "ecoar" o que acabou de ler sobrescrevia escritas externas.
- Limitação conhecida: dois usuários editando a mesma tabela ao mesmo tempo se sobrescrevem (último ganha). A KB grava **por item** (\`POST\` objeto / \`DELETE ?id=\`) justamente para evitar isso.
- Aprovação pendente não é tabela: é o bloco parado em \`awaiting_client_material_validation\` ou \`awaiting_client_final_validation\`.
- Blocos usados de um contrato = contagem real de blocos (\`usedBlocksOf\`), não o campo \`usedBlocks\`.

## Backups
Antes de importações grandes, retrato das tabelas em \`s3://archtechtour-assets/backups/\`.
`,
    ["dynamodb", "dados", "tabelas"]),

  article("ka_ti_analytics", TI, "Dados & Analytics", 5, "Pipeline de analytics (Athena)",
    `
Pipeline própria, **sem Google Analytics**:

\`\`\`
Customizador → enviarEventoCustomizador()
  → API Gateway /register-event (us-east-1)
  → Lambda RegistrarEventoCustomizador → tabela raw eventos_customizador
  → Lambda parquet-monthly-etl (DIÁRIO, 02h UTC) → Athena eventos_parquet (mês corrente + anterior)
  → Lambda analytics-compute (dia 1º, 04h UTC) → POST /api/analytics/{alias}/refresh
  → cache S3 archtechtour-assets/analytics-cache/{alias}/latest.json
  → Portal lê via GET /api/analytics/{alias}
\`\`\`

- Views e dashboard consultam \`eventos_parquet\` (particionado). Dashboard **zerado** num mês = quase sempre o ETL ainda não processou aquele período → rodar a Lambda com \`{"targetMonth":"YYYY-MM"}\`.
- Builder das queries: \`src/lib/analytics-builder.ts\` (com filtro de bots, pagespeed, monitores e tráfego interno). Dashboard: \`src/components/AnalyticsDashboard.tsx\`. Métrica "Engajamento Real" + insights por IA.
- Mapa cliente ↔ alias: \`dim_client_alias\` (S3 \`explorar.archtechtour.com/dim/\`). Produto sem prefixo de alias é resolvido pelo \`dim_produto_cliente\` (script \`scripts/gerar-dim-produto-cliente.py\`).
- Para incluir cliente no analytics: **Analytics → Gerenciar clientes → Adicionar** (alias + nome) e depois **Gerar**. O nome digitado vira a chave do refresh.
- Refresh do dia a dia: botão "Atualizar" no dashboard do cliente. \`POST /api/analytics/refresh-all\` só por API (invoca a Lambda para todos).
- Pendência: o JS do customizador (Verge3D) só manda \`session_id\` no \`session_start\`; AR/download/whatsapp ainda vêm sem — patch pendente.
`,
    ["athena", "analytics", "etl", "lambda"]),

  article("ka_ti_lambdas", TI, "Infraestrutura", 6, "Lambdas e crons (EventBridge)",
    `
| Lambda | Cron | Função |
|---|---|---|
| \`parquet-monthly-etl\` | diário, 02h UTC | raw → Parquet (mês corrente + anterior). Apaga a partição antes de reinserir (idempotente). Aceita \`{targetMonth}\` ou \`{targetMonths:[…]}\`. 900 s / 1024 MB |
| \`analytics-compute\` | dia 1º, 04h UTC | chama o refresh de cada cliente (janela móvel 30 d ou período do payload) |
| \`auditoria-compute\` | domingo, 03h UTC | valida todos os customizadores publicados (12 checks/produto) → \`s3://…/_auditoria/\` |
| \`site-watchdog\` | de hora em hora (\`site-watchdog-hourly\`) | Argus Watchtower: lê a rotina em \`att-agent-routines\` e só age nas horas configuradas; testa URLs, envia e-mail via SES, grava histórico. Role \`lambda-site-watchdog-role\`. 120 s / 256 MB |

Código em \`lambda/\`. Deploy via AWS CLI (profile \`att-admin\`) ou \`deploy.sh\` de cada pasta.
`,
    ["lambda", "cron", "eventbridge"]),

  article("ka_ti_agentes", TI, "Portal", 7, "Agentes de IA e Argus Watchtower",
    `
Aba **Agentes AI** (só admin). Todos herdam \`src/lib/agent-context.ts\` (contexto de negócio + arquitetura), rodam Haiku 4.5 com retry/fallback (\`src/lib/claude-retry.ts\`) e têm API própria em \`src/app/api/agents/<nome>\`.

| Agente | Função |
|---|---|
| **Sherlock Codes** | caça bugs de integridade do banco (órfãos, mismatches, duplicatas) — veredito pré-calculado no backend |
| **Monk Lighthouse** | QA dos customizadores publicados: HTTP, analytics, downloads, AR, escala |
| **Yoda Kanban** | gerente de projetos: saúde do portfólio, riscos, ações para a PM |
| **Harvey Closer** | comercial/retenção: traduz analytics em valor e ações |
| **Argus Watchtower** | monitor de disponibilidade — **não usa Claude**; roda sozinho na Lambda \`site-watchdog\` |

**Regra:** agentes nunca inventam números/preços — só dados reais.

## Argus Watchtower
- Rotina padrão: 13h e 21h (Brasília), e-mail para \`info@archtechtour.com\` e o dono técnico, alvo \`https://archtechtour.com\`, avisa sempre.
- Tudo editável na tela do agente (horários, destinatários, sites, texto esperado, timeout, tentativas, liga/desliga); a Lambda relê a rotina a cada execução.
- Anti-falso-positivo: \`retries\` tentativas espaçadas em 5 s. Anti-duplicidade: lock por slot (\`argus-watchtower#YYYY-MM-DDTHH\`).
- SES em sandbox: destinatário novo fora do domínio precisa ser verificado (\`aws sesv2 create-email-identity --email-identity NOVO@dominio.com --region us-east-1 --profile att-admin\`).
`,
    ["agentes", "claude", "argus", "monitoramento"]),

  article("ka_ti_api", TI, "Portal", 8, "Endpoints da API",
    `
## Estado (DynamoDB)
\`GET/POST /api/state/{blocks,tickets,activities,clients,contracts,publications,users,bim-demands,finishes,kb}\` — POST aceita item único (upsert) ou array (replaceAll). Algumas rotas aceitam \`DELETE ?id=\` (clients, contracts, publications, users, kb).

## Manutenção (admin, server-side — rodar com \`curl -X POST\` após deploy)
- \`/api/state/reseed\` — limpa e re-popula tabelas com o seed consolidado
- \`/api/state/reconcile-publications\` — cruza S3 ↔ DynamoDB, publica blocos com customizador no S3
- \`/api/state/import-orphans\` — cria blocos para customizadores no S3 sem bloco

## Analytics
\`GET /api/analytics/{client}\`, \`POST /api/analytics/{client}/refresh\`, \`POST /api/analytics/{client}/insights\`, \`GET /api/analytics/clients\`, \`POST /api/analytics/refresh-all\`.

## Agentes
\`POST /api/agents/{sherlock-codes,monk-lighthouse,yoda-kanban,harvey-closer}\`; Argus: \`GET/POST /api/agents/argus-watchtower\`, \`GET/PUT /api/agents/argus-watchtower/routine\`.

## Arquivos
- \`/api/upload\` — URL pré-assinada para arquivos de bloco (\`clientes/{clientId}/blocos/{blockId}/…\` no \`archtechtour-assets\`).
- \`/api/analyze\` — análise por IA do arquivo enviado.
- \`/api/kb/upload\` e \`/api/kb/file\` — anexos da Base de Conhecimento (prefixo \`kb/\`).

## Outros
\`/api/auth/[...nextauth]\`, \`/api/instant/*\` (ATT Instant).
`,
    ["api", "endpoints"]),

  article("ka_ti_operacoes", TI, "Operação", 9, "Rotinas operacionais (cadastrar cliente, dashboards zerados, SES)",
    `
## Cadastrar um cliente novo ponta a ponta (tudo pela UI, perfil admin)
1. **Clientes → Novo Cliente** — nome, \`code\` (= alias do Athena: minúsculo, sem espaço/acento) e e-mail.
2. **Contratos → Novo Contrato** — cliente + *Total Blocos* (sem contrato com folga não dá para cadastrar produto).
3. **Usuários → Novo Usuário** — perfil *Cliente* + o cliente criado.
4. **Analytics → Gerenciar clientes → Adicionar** (alias + nome) → **Gerar**. O nome digitado é a chave do refresh; se divergir do dim, o dashboard vem vazio.

## Dashboard zerado
Quase sempre o \`parquet-monthly-etl\` ainda não processou o período. Rodar a Lambda com \`{"targetMonth":"YYYY-MM"}\` e depois "Atualizar" no dashboard.

## Cliente sem prefixo no nome do produto
O dono do evento sai do \`dim_produto_cliente\`. Regerar com \`scripts/gerar-dim-produto-cliente.py\`.

## Importações do Notion
Scripts e regras em \`scripts/notion-import/\` (Banco de Produtos → \`att-blocks\`; acabamentos → \`att-finishes\`). Regra-mãe: **nunca rebaixar bloco \`published\`**. Reimportar não sobrescreve o que foi editado no portal.

## Antes de mexer em dado de produção
Fazer backup das tabelas em \`s3://archtechtour-assets/backups/\` e rodar em horário sem uso — o portal aberto durante uma escrita externa pode gravar um retrato antigo por cima.
`,
    ["operação", "runbook", "clientes"]),

  article("ka_ti_instant", TI, "Produtos", 10, "ATT Instant (foto → 3D por IA)",
    `
Funil público no mesmo app: \`/experimentar\` (wizard de geração 3D self-service a partir de foto) e plano "Instant" em \`/planos\`.

- Arquivos: \`src/app/experimentar/*\`, \`src/app/api/instant/*\`, \`src/components/InstantWizard.tsx\`, \`InstantResultado.tsx\`, \`src/lib/instant-categorias.ts\`.
- Armazena no bucket \`explorar.archtechtour.com\` sob o prefixo \`_instant/\` (política IAM \`ATTInstantPortal\`).
- Planos/preços exibidos ainda **não** estão em prática comercial.
`,
    ["instant", "ia"]),

  article("ka_ti_customizador", TI, "Produtos", 11, "Customizadores 3D (Verge3D) e publicação",
    `
- Cada produto publicado vive em \`explorar.archtechtour.com/<alias>/<versão>/<produto>/\` (bucket S3 estático). O portal registra a URL e gera o \`embed\` em **Publicações**.
- Os customizadores são feitos em **Verge3D**; o \`ui.js\` de cada um define downloads, AR e eventos de analytics (\`enviarEventoCustomizador()\`).
- QA automático: Lambda \`auditoria-compute\` (semanal) e agente **Monk Lighthouse** (sob demanda).
- Caso conhecido: embed apontando para o produto errado no site do cliente (Persol ↔ Tidelli) — a correção é no site do cliente, não no nosso código.
- Pendência: anexar \`session_id\` nas interações do customizador (hoje só o \`session_start\` tem).
`,
    ["verge3d", "customizador", "publicação"]),

  article("ka_ti_pendencias", TI, "Operação", 12, "Pendências e riscos conhecidos",
    `
- 🔴 **Rotacionar a chave AWS legada** do usuário \`powerbi-athena-user\` — adiada a pedido do dono. (O identificador da chave está no \`PORTAL.md\` §13; não fica aqui.)
- 🟡 Patch no JS do customizador (Verge3D): \`session_id\` nas interações.
- 🟡 Planos/preços do portal não estão em prática comercial.
- 🟡 Concorrência: duas pessoas editando a mesma tabela ao mesmo tempo se sobrescrevem (gravação por tabela).
- 🟡 SES em sandbox: destinatários fora de \`@archtechtour.com\` precisam ser verificados.
- 🟢 Migração Notion/Planner → portal concluída (blocos, tickets, publicações, BIM, acabamentos).
`,
    ["pendências", "riscos"]),

  article("ka_ti_kb", TI, "Portal", 13, "Base de Conhecimento — como funciona",
    `
- Tabela \`att-kb\` com dois tipos de registro: \`base\` e \`article\` (tipos em \`src/lib/kb.ts\`).
- **Acesso por base:** \`access\` (quem vê) e \`editors\` (quem edita), cada um com perfis (grupos) e/ou usuários. Admin sempre vê e edita. A tela "Base de Conhecimento" aparece para quem tem ao menos uma base liberada.
- **Persistência por item** (\`POST\` objeto / \`DELETE ?id=\` em \`/api/state/kb\`) — não usa o \`replaceAll\` das outras tabelas, para dois editores não se sobrescreverem.
- **Anexos:** upload direto do browser para \`s3://archtechtour-assets/kb/<base>/<artigo>/…\` via URL pré-assinada (\`POST /api/kb/upload\`); download por \`GET /api/kb/file?key=…\` (redireciona para URL assinada de 15 min); remoção por \`DELETE /api/kb/file?key=…\`.
- Requisitos de infra: tabela \`att-kb\` na política \`DynamoDBPortalAccess\`, permissão \`s3:DeleteObject\` em \`archtechtour-assets/kb/*\` e a origem \`https://app.archtechtour.com\` no CORS do bucket (script em \`scripts/kb-infra.sh\`).
- O corpo dos artigos é Markdown (subconjunto): \`#\` títulos, listas, \`**negrito**\`, \`código\`, blocos de código, links, citações e tabelas.
`,
    ["kb", "base de conhecimento"]),
];

// ------------------------------------------------------------
// ARTIGOS — Base de TI: site archtechtour.com (repo arxpalhano/att-site)
// ------------------------------------------------------------
const ARTIGOS_TI_SITE: KbArticle[] = [
  article("ka_ti_site_visao", TI, "Site archtechtour.com", 20, "Site institucional (WordPress no Cloudways, atrás da Cloudflare)",
    `
O site **archtechtour.com** é institucional + catálogo (WordPress/WooCommerce), herdado da agência **WId** em jul/2026. Não é loja: produtos têm botões "3D"/"Saiba mais", sem carrinho. A memória operacional completa está no repositório **\`arxpalhano/att-site\`** (privado) — sem segredos, só "onde está e como pedir" cada acesso.

## Stack
| Camada | O quê |
|---|---|
| Hospedagem | Cloudways (DigitalOcean), plano 4 GB desde 08/09/2026 (era 2 GB) |
| Web | nginx (80/443) → Varnish (8080) → Apache 2.4 + PHP-FPM 8.3 (8081) |
| App | WordPress + WooCommerce, tema próprio \`archtechtour_ecommerce\` (WId), ACF Pro |
| Filtros do catálogo | YITH WooCommerce Ajax Product Filter Premium (preset \`default-preset\`) |
| Busca | FiboSearch (versão gratuita — busca só título/conteúdo/resumo) |
| Cache | Breeze (página em disco + minificação), Varnish, Object Cache Pro (Redis) |
| Segurança | Wordfence + Sucuri, Imunify360 (Cloudways), WAF artesanal no \`.htaccess\`, Cloudflare WAF |
| Backup | UpdraftPlus |
| DNS \`.com\` | **Cloudflare** desde 08/09/2026 (registrar GoDaddy). Só apex e \`www\` passam pelo proxy |
| DNS \`.com.br\` | ClouDNS (registrar Registro.br, titular Paulo Dau Filho) — só redireciona para o \`.com\` |
| E-mail \`.com\` | MX Microsoft 365 |

## Caminho de uma requisição
Cloudflare (edge, WAF) → nginx (se existir arquivo em \`wp-content/cache/breeze/\`, serve direto!) → Varnish → Apache (\`.htaccess\`) → PHP-FPM → WordPress.
**Consequência:** mudança de conteúdo/menu pode ficar invisível por dias se o Breeze não for limpo. \`age: 0\` no Varnish não prova frescor.

## Limites do acesso SSH (usuário master, sem sudo)
- Nada em \`/etc/\` é editável; serviços só reiniciam pelo painel Cloudways (Manage Services).
- \`wp-cli\` está quebrado → usar \`mysql\` + \`php -r 'require "wp-load.php"; …'\`.
- Só \`public_html\` é gravável.

## Subdomínios AWS (fora do WordPress)
\`marketing\` (landing /b2b, CloudFront + S3 + Lambda), \`explorar\` (customizadores/AR), \`app\` (portal), \`validacaoatt\` (staging dos customizadores).

## Regras para quem opera o site
1. Nunca commitar token, senha ou dump de banco.
2. Mudança que pode derrubar site ou e-mail: **só à noite**, com rollback pronto e testado.
3. Antes de editar o \`.htaccess\`: \`wc -c\`, backup com timestamp, nunca confiar em \`cat | head\`.
4. Testar filtros **sempre com user-agent de iPhone e de desktop**.
5. Depois de qualquer mudança em menu/ACF/conteúdo: rodar \`scripts/purge-cache.sh\`.
6. Toda mudança relevante volta para o repo \`att-site\` (docs ou scripts).
`,
    ["site", "wordpress", "cloudways", "cloudflare"]),

  article("ka_ti_site_acessos", TI, "Site archtechtour.com", 21, "Como obter cada acesso do site (sem segredos)",
    `
Regra: **nunca peça senha**. Peça chave/token com escopo, ou que o Palhano faça o clique.

| Acesso | Como conseguir |
|---|---|
| **SSH no servidor** (usuário master, sem sudo) | Gere \`ssh-keygen -t ed25519\` e peça ao Palhano para adicionar a chave pública em Cloudways → Servers → Master Credentials → SSH Public Keys |
| **Cloudflare** | Conta do Palhano. Peça um API Token com escopo (Zone: Edit, DNS: Edit, Zone Settings: Edit, Zone WAF: Edit) e expiração curta. Guardar em \`~/.cf_token\` (chmod 600). **Nunca colar token no chat** |
| **Painel Cloudways** | Login do Palhano. Só o painel reinicia serviços, faz upgrade de plano, purge do Varnish, abre ticket e autoriza chave SSH |
| **GoDaddy** (\`.com\`) | Conta do Palhano — só para nameservers/lock |
| **Registro.br** (\`.com.br\`) | Titular Paulo Dau Filho; o Palhano intermedeia |
| **ClouDNS** | Conta herdada da WId; zona \`.com.br\` vive lá e a zona \`.com\` fica como rollback |
| **WordPress admin** | Peça ao Palhano um usuário Administrador próprio. Header/menus → página de opções ACF "Header"; marcas do filtro → YITH → Filter Presets; cache → Breeze → Purge all |
| **AWS** (subdomínios) | Conta \`891377125620\`, profile \`att-admin\` — ver artigo "Stack e infraestrutura AWS" |
| **GitHub** | Usuário/org \`arxpalhano\`: \`att\`, \`att-site\`, \`att-instant\`, \`att-agents\` |
`,
    ["acessos", "site", "cloudflare", "cloudways"]),

  article("ka_ti_site_incidente", TI, "Site archtechtour.com", 22, "Incidente ago/2026: botnet derrubando o site (e o que ficou de proteção)",
    `
## Sintoma
Site fora do ar; restart pelo Cloudways ressuscitava por ~20 min e caía de novo. CPU 100 %, swap 100 %.

## Diagnóstico (21/08/2026)
- 97 % das requisições eram URLs de faceta do filtro (\`?filter_…\`, \`?yith_wcan=1\`) vindas de ~25.700 IPs distintos com UA de Chrome legítimo → **botnet de proxies residenciais** raspando combinações de filtro.
- Cada faceta nova gravava linha no cache do YITH → tabela \`wp_yith_wcan_cache\` com 1,5 GB (83 % do banco) → buffer pool maior que a RAM → MariaDB no swap → PHP-FPM (10 workers) travado → site cai.

## O que foi feito (ordem importa: bloquear antes de limpar)
1. \`.htaccess\` **BLOCO 5**: 403 para \`filter_\`/\`yith_wcan\` sem Referer do site e sem passar pela Cloudflare.
2. \`TRUNCATE wp_yith_wcan_cache\` (banco 1,8 GB → 297 MB) e limpeza do Action Scheduler.
3. 28/08: liberado quem tem Referer do próprio site (98,6 % dos bloqueados não tinham Referer).
4. 08/09: migração do DNS para **Cloudflare** com Managed Challenge nas URLs de faceta (skip quando o Referer é o site) + upgrade para 4 GB.

## Números de referência
- Tráfego legítimo: 2–30 req/min chegando ao PHP. 100+ req/min em facetas = ataque.
- \`wp_yith_wcan_cache\` saudável: poucos milhares de linhas. Acima de 100 mil, algo está raspando o site.

## Erros cometidos (para não repetir)
- \`cat | head\` cortou o \`.htaccess\` e ele foi sobrescrito "vazio" → permalinks 404 por 10 min. Sempre \`wc -c\` e backup antes.
- \`[OR]\` no mod_rewrite tem precedência menor que o AND implícito: \`A [OR] / B / C\` = \`A OR (B AND C)\`.
- Testar só com \`curl\` dá 403 falso (o WAF bloqueia UA contendo "curl") — usar UA de navegador **e** de iPhone.
`,
    ["incidente", "site", "waf", "botnet"]),

  article("ka_ti_site_runbooks", TI, "Site archtechtour.com", 23, "Runbooks do site (cache, filtros, marca nova, rollback, e-mail)",
    `
Scripts em \`arxpalhano/att-site/scripts\`: \`healthcheck.sh\` (sem acesso), \`purge-cache.sh\` (SSH), \`rollback-archtechtour.sh\` (SSH), \`cf_verify.py\` / \`cf_migrate.py\` (token Cloudflare).

## Site lento / caindo — triagem
\`uptime; free -m\`, processos por CPU, quem está no swap, URLs e IPs mais frequentes no access log, tamanho das tabelas e \`wp_actionscheduler_actions\` por status, \`php-app.slow.log\`. Serviços só reiniciam pelo painel Cloudways.

## Limpar caches (após editar menu, ACF, conteúdo, .htaccess)
\`bash scripts/purge-cache.sh\` — apaga o cache do Breeze em disco e faz PURGE/BAN no Varnish. Sem SSH: WP admin → Breeze → Purge all cache + Cloudways → Purge Varnish. A Cloudflare não cacheia HTML.

## Testar filtros do jeito certo
Sempre com **Referer do site** e dois user-agents (desktop e iPhone). Sem Referer o esperado é 403/challenge. Para testar sem cache: bater direto no Apache (\`:8081\`) de dentro do servidor.

## Cadastrar marca nova no site (checklist)
Categoria \`product_cat\` + termo \`pa_marca\` + atributo nos produtos (**não herdar do clone** — produto duplicado herda a marca do original) + termo no preset YITH (filtro Marcas) + item no menu ACF Header (aba Marcas) + vitrine em "Capas categorias" + purge de cache. Trocar termo por \`wp_set_object_terms\` **não** atualiza o filtro do WooCommerce na hora — regenerar \`wp_wc_product_attributes_lookup\` (\`LookupDataStore::create_data_for_product\`).

## "A busca não acha os produtos da marca X"
FiboSearch gratuito só busca título/conteúdo/resumo. Fix aplicado: mostrar Categorias/Tags no autocomplete. Para produtos aparecerem ao digitar a marca: FiboSearch Pro ou nome da marca no resumo dos produtos.

## Rollback de DNS
GoDaddy → nameservers de volta para \`pns1–4.cloudns.net\` (zona intacta na ClouDNS; export em \`dns/archtechtour.com.zone\`). Validar MX primeiro.

## Validar e-mail (o que mais dói se quebrar)
MX em 3 resolvers deve devolver \`archtechtour-com.mail.protection.outlook.com\`; SPF \`include:spf.protection.outlook.com\`; handshake SMTP na porta 25.

## Pendências do site (08/09/2026)
- 🔴 Revogar token Cloudflare colado em chat em 28/08.
- \`www.archtechtour.com.br\` quebrado (CNAME aponta para o \`.com\` proxied) — corrigir na ClouDNS.
- Ticket Cloudways: \`innodb_buffer_pool_size\`, \`MaxRequestWorkers\`, wp-cli quebrado.
- DMARC duplicado no \`.com\` (inválido); SPF só autoriza Outlook enquanto há DKIM de SendGrid/Brevo/ElasticEmail/SES.
- Registros legados perigosos (\`api\` IP desligado, \`game\` IP privado) nas duas zonas.
- Wordfence + Sucuri + Imunify360 ao mesmo tempo custam CPU num servidor pequeno.
`,
    ["runbook", "site", "cache", "dns"]),

  article("ka_ti_instant_worker", TI, "Produtos", 24, "ATT Instant — máquina de processamento (Windows) e pipeline foto → 3D",
    `
Repositório **\`arxpalhano/att-instant\`**: pipeline foto → 3D avaliado (geração por IA, normalização no Blender, QA visual) e o worker da fila.

## Onde roda cada etapa
| Etapa | Onde | GPU? |
|---|---|---|
| Geração do 3D a partir da foto | Nuvem (Tripo / Rodin, por API) | não |
| Normalização no Blender (escala, pivô, nomenclatura, GLB/USDZ) | máquina Windows do escritório | não (CPU) |
| Render das 4 vistas para QA | máquina Windows | ajuda (EEVEE roda em AMD) |
| Nota de fidelidade | Nuvem (Claude) | não |

## Máquina de processamento
- **Status:** instalada e rodando em \`i7-deft-2023\` (Windows 11) desde 23/07/2026. Blender 5.x, Python 3.14, AWS CLI 2. Worker registrado como tarefa agendada **ATT Instant Worker** (roda como SYSTEM, sobe com o Windows, reinicia sozinho).
- Bucket \`explorar.archtechtour.com\`, prefixo \`_instant\` (configurável por \`INSTANT_BUCKET\`/\`INSTANT_PREFIX\`).

## Lições da instalação
- **GitHub por SSH não funciona na rede do escritório** (inspeção de pacotes estrangula SSH em qualquer porta). O código é copiado do Mac por \`scp\`/tar na LAN, não por \`git clone\`.
- **Console do Windows é cp1252**: \`print\` com acento quebra o worker → rodar com \`PYTHONUTF8=1\`.
- **Credenciais para o SYSTEM**: a tarefa não enxerga o \`.aws\` do usuário; as chaves AWS ficam como variáveis de ambiente **de máquina**.
- Guia completo: \`windows/SETUP.md\` no repo.
`,
    ["instant", "worker", "windows", "blender"]),

  article("ka_ti_repos", TI, "Visão geral", 25, "Repositórios Git e onde cada coisa está documentada",
    `
| Repositório (GitHub \`arxpalhano\`) | O que é | Documentação |
|---|---|---|
| \`att\` | Portal + ATT Instant (Next.js 14, Amplify) | \`CLAUDE.md\`, \`PORTAL.md\` |
| \`att-site\` | Memória operacional do site WordPress (Cloudways/Cloudflare): infra, DNS, incidentes, runbooks, acessos | \`README.md\`, \`docs/01…11\` |
| \`att-instant\` | Pipeline foto → 3D (Tripo/Rodin + Blender + QA) e worker Windows | \`windows/SETUP.md\` |
| \`att-agents\` | Plugins Claude Code para o pipeline de produção (Validador em piloto; Onboarding, Programador, Modelador planejados) | \`README.md\`, \`docs/pipeline.md\`, \`docs/pessoas-papeis.md\` |

## Pastas de trabalho (Microsoft 365)
- SharePoint site **tech** → \`Shared Documents\`: \`1 - Builders\` (1- Tecnologia com pastas por marca, 2- Backoffice, 3- Biblioteca de Acabamentos, 4- BIM Modelos Terceirizados), \`2 - Produto e Tecnologia\` (Novas marcas, Mostras, Plataforma + Integração, P&D), \`7 - Checklist Customizador\`.
- Sites por cliente (ex.: \`DengoPetlovers2\`, \`GreenHouse2\`, \`PedroFranco2\`) com \`1 - Contrato\`, \`2 - Materiais Marketing\`, \`3 - Blocos\`, \`4 - Acabamentos\`, \`5 - Imagens\`.
- Site **ATT-Financeiro** → \`1 - Financeiro\`.
- OneDrive do Palhano → \`Archtechtour\`: \`1 - Pm\`, \`2 - Planejamento Estrategico\` (Blueprint), \`3 - Index Customizador\` (index.html de cada customizador), \`4 - certificado digital\`, \`5 - Automação BIM\` (manual do orquestrador).
`,
    ["repositórios", "sharepoint", "onde está"]),
];

// ------------------------------------------------------------
// ARTIGOS — Base Tech (repo att-agents, docs do SharePoint/OneDrive)
// ------------------------------------------------------------
const TECH = "kb_tech";
const ARTIGOS_TECH_EXTRA: KbArticle[] = [
  article("ka_tech_pipeline", TECH, "Modelagem de produto", 2, "Pipeline de produção: do recebimento à publicação",
    `
Mapeado a partir dos Processos 01/02/03 do SharePoint e dos relatórios da equipe (maio/2026).

\`\`\`
Cliente → Onboarding → Modelador → Programador → Tech Lead → S3/CloudFront → embed no site do cliente
                        (Blender,    (Verge3D,     (validação,
                         PixPlant,    Puzzles,      publicação,
                         UV)          JS)           analytics)
\`\`\`

## 1. Recebimento (Cliente → Onboarding)
- Cliente envia: arquivos SKP, fotos de texturas, regras de combinação, referências visuais.
- Onde fica: SharePoint \`tech\` → \`2 - Produto e Tecnologia/Novas marcas/<cliente>/\`.
- Problema recorrente: cada cliente manda de um jeito, sem padronização.

## 2. Modelagem (modelador)
**Texturização:** editar imagens para remover seams (PixPlant, GIMP, clone stamp) → normal map → nomenclatura das texturas → escalas compatíveis (**evitar node de mapping — não funciona em AR/iPhone**) → materiais no Blender + shader → ajuste de cor.
**Modelagem:** aproveitar o SKP do cliente (Tris-to-Quads) → retopologia automática (Quad Remesher) ou manual → modelagem do zero se necessário → UV → validação (escala + visual vs referência).

## 3. Template Verge3D (modelador → programador)
Configurações do template → UV vs textura → origem no centro → luzes (3 pontos + HDRI) e câmera 3/4 → limpar arquivo → exportar \`.gltf\` (geometria separada por material) + \`.fbx\` → zipar e enviar.

## 4. Programação Verge3D (programador)
\`texture-data.js\`, lógica de combinação de materiais, UI dinâmica, Puzzles.

## 5. Validação + publicação (tech lead)
Checklist de 12 itens (artigo próprio) → upload no S3 (**sempre sobrescrevendo a mesma pasta**, nunca mudar o path do embed) → invalidação do CloudFront (obrigatória) → comunicação com o cliente.

## Percentuais de esforço por etapa (Checkpoint da PM)
| Etapa | % |
|---|---|
| Pré-produção (seleção de produtos, planilha da marca, texturas, fotos, SKPs) | 10 % |
| Modelagem (geometria, subdivisão, malha, clipping, escala/rotação, sem parenting) | 40 % |
| Look dev (cor, texturas seamless, normal maps, UV, materiais e shader) | 20 % |
| Exportação (nomenclatura do manual de boas práticas, \`.fbx\` com texturas embutidas) | 10 % |
| Aprovação / ajustes com a marca | 10 % |
| 3D viewer / AR (publicação, cena, HDRI, escala AR, coleção da marca) | 10 % |
`,
    ["pipeline", "modelagem", "verge3d"]),

  article("ka_tech_dores", TECH, "Programação do customizador (Verge3D)", 3, "As 10 dores da programação (o que o modelador precisa entregar certo)",
    `
Do relatório "Problemas e inconsistências" (28/04/2026). Cada item vira um ponto de checklist antes de mandar o modelo para programação.

1. 🔴 **Nomenclatura inconsistente** — \`Material01\`, \`Default\`, \`Lambert2\`. Puzzles quebram por nome.
2. 🟠 Falta de padronização entre clientes.
3. 🟡 Referência visual confusa (cards mal feitos).
4. 🟢 Lógica de combinação mal definida pelo cliente.
5. 🔵 Arquivos 3D desorganizados (hierarquia, pivot, escala).
6. 🟣 Texturas problemáticas (nome da textura ≠ nome do material).
7. ⚫ Falta de documentação mínima do cliente.
8. ⚪ Mudanças constantes sem controle de versão.
9. 🟤 Expectativa desalinhada do cliente.
10. ⚫ Problemas específicos de integração com Verge3D.

> Padrão sugerido de nome: \`material_acabamento_codigo\`. Texturas com o mesmo nome do material.
`,
    ["verge3d", "nomenclatura", "programação"]),

  article("ka_tech_checklist", TECH, "Checklist de qualidade e publicação", 4, "Checklist de validação do customizador (12 itens)",
    `
Usado antes de publicar. Automatizado pelo plugin **att-validador** (\`/validar s3://explorar.archtechtour.com/<alias>/<versão>/<produto>/\`).

| # | Check | Crítico? |
|---|---|---|
| 1 | \`index.html\` existe na pasta do produto | ✅ |
| 2 | Arquivos Verge3D presentes: \`v3d.js\`, \`model.js\`, \`ui.js\`, \`visual_logic.js\`, \`visual_logic.xml\` | ✅ |
| 3 | \`data-produto-id\` no \`<body>\` bate com \`<cliente>-<produto>\` | ⚠️ |
| 4 | Pelo menos um \`.gltf.xz\` ou \`.bin.xz\` (modelo carregável) | ✅ |
| 5 | Texturas referenciadas no \`visual_logic.xml\` existem na pasta | ✅ |
| 6 | Download SketchUp: \`/mostra/<Cliente>/<Produto>/Sketchup-<Produto>.zip\` responde 200 | ✅ |
| 7 | Download Archicad: \`/mostra/<Cliente>/<Produto>/Archicad-<Produto>.zip\` responde 200 | ✅ |
| 8 | Download Revit: \`/mostra/<Cliente>/<Produto>/Revit-<Produto>.zip\` responde 200 | ✅ |
| 9 | URLs de download no \`index.html\` apontam para o produto certo (não copiadas de outro) | ⚠️ |
| 10 | Endpoint de analytics presente (\`…/register-event\`) | ⚠️ |
| 11 | Sem \`.DS_Store\` na pasta | ⚠️ |
| 12 | Pasta < 100 MB | ⚠️ |

Publicação **bloqueada** com ❌ em item crítico. Avisos não bloqueiam, mas entram no relatório.

## Política inquebrável
- **Nunca** alterar o path do embed.
- Atualizações sobrescrevem **a mesma pasta**.
- Invalidação do CloudFront de produção é **obrigatória** após o upload.
- Staging: bucket \`validacaoatt.archtechtour.com\` (CloudFront próprio).
`,
    ["checklist", "publicação", "validação"]),

  article("ka_tech_papeis", TECH, "Início", 5, "Quem faz o quê no pipeline",
    `
| Papel | Responsabilidades |
|---|---|
| **Onboarding / PM** | Recebe o material do cliente, reunião de alinhamento, catalogação (recortes, descritivos, capas de marca, dimensões), validação com o cliente, entrega final e integração dos embeds com o TI do cliente |
| **Modelador** | Texturização (PixPlant, GIMP, seams, normal maps), modelagem (Blender, Tris-to-Quads, Quad Remesher, UV), setup Verge3D (template, luzes, câmera, export gltf/fbx) |
| **Programador** | Recebe o \`.gltf\`, cria \`texture-data.js\`, Puzzles, lógica JS de combinação e UI do customizador |
| **Tech Lead** | Valida (downloads SKP/Archicad/Revit, AR Android/iOS USDZ, embed), publica no S3, invalida CloudFront, aprova comunicação com o cliente |
| **QA** | Revisão visual + funcional pré-entrega; planilhas de ajustes ("AJUSTES DD_MM.pdf", "revisão EB …") |
| **Comercial / Admin** | Recebem materiais oficiais em cópia (Processo 03) e atendem no padrão formal (Processo 02) |
| **Terceirizados BIM** | Conversão dos blocos para Revit/ArchiCAD/SketchUp — controlada na tela **BIM · Terceirizados** do portal |

## Agentes de apoio (repo \`att-agents\`)
- ✅ **att-validador** (piloto): checklist + upload S3 + invalidação CloudFront.
- 🟡 **att-onboarding** (próximo): lê a pasta do cliente no SharePoint, valida nomenclatura, lista materiais e pede o que falta por e-mail.
- 🟡 **att-programador**: lista materiais do \`.gltf\`, sinaliza nomes genéricos, gera \`texture-data.js\`.
- 🔵 **att-modelador**, **att-texturizador**, **att-automacao-bim**, **att-comunicacao**, **att-qa** (planejados).
`,
    ["papéis", "equipe", "agentes"]),

  article("ka_tech_bim_automacao", TECH, "Blocos BIM (ArchiCAD / Revit / SketchUp)", 6, "Automação BIM: FBX → OBJ + IFC sem intervenção manual",
    `
Fonte: "Manual Técnico de Setup — Orquestrador de Automação BIM" (OneDrive → Archtechtour → 5 - Automação BIM).

## Arquitetura
- **Ponte de sincronização:** OneDrive/SharePoint (\`ATT - Automação BIM\` → \`BIM_Entrada\`, \`BIM_Saida\`, \`BIM_Processados\`).
- **Orquestrador (gatilho):** MacBook rodando **n8n** local (\`NODES_EXCLUDE="[]" n8n\`, painel em \`http://localhost:5678\`, nó *Local File Trigger* em "File Added" na pasta \`BIM_Entrada\`).
- **Worker:** PC Windows com Python, **Blender 5.0** e o add-on **Bonsai (BlenderBIM)** em modo headless. Scripts em \`C:\\Automacao_BIM\\\`: \`vigilante.py\` (monitora a pasta, chama o Blender, organiza os arquivos) e \`conversor_fbx.py\` (importa FBX, exporta OBJ/MTL, cria projeto BIM e salva IFC como \`IfcFurniture\`).

## Saídas
- **.OBJ + .MTL** — geometria para SketchUp e renderizadores.
- **.IFC (IfcFurniture)** — OpenBIM para Revit, ArchiCAD etc.

## Uso pela equipe de modelagem
1. Finalizar o modelo e exportar **FBX binário** (FBX ASCII dá erro).
2. Colar em \`BIM_Entrada\`; aguardar 10–20 s.
3. Recolher \`.obj\`, \`.mtl\` e \`.ifc\` em \`BIM_Saida\`.

## Orientação ao cliente (Revit)
**Não** usar "Abrir IFC". Caminho correto: projeto \`.rvt\` → Inserir → **Vínculo de IFC** (Link IFC). O bloco entra na categoria Mobiliário para tabelas e quantitativos.

## Pendente / observações
- O vigilante roda num CMD aberto durante o expediente; ainda não é serviço.
- Relação com o portal: as demandas de conversão manual seguem na tela **BIM · Terceirizados**.
`,
    ["bim", "ifc", "blender", "n8n"]),
];

// ------------------------------------------------------------
// ARTIGOS — Base Comercial (Blueprint Estratégico) e Marketing (ferramentas)
// ------------------------------------------------------------
const ARTIGOS_COMERCIAL_EXTRA: KbArticle[] = [
  article("ka_comercial_blueprint", "kb_comercial", "Proposta de valor e pitch", 1, "Blueprint Estratégico ArchTechTour",
    `
Fonte: "Blueprint Estratégico Archtechtour" (OneDrive → Archtechtour → 2 - Planejamento Estrategico).

## 1. Proposição de valor
- **Transformação digital para marcas de móveis**: visualização e venda de produtos com modelagem 3D e realidade aumentada.
- **Capacitação de arquitetos** com ferramentas interativas de personalização detalhada, melhorando a experiência do cliente final e otimizando o design.

## 2. Como geramos valor
**Modelo SaaS — "apenas uma ID e IA":**
- Plataforma robusta e contínua: hospedagem dos embeds em servidores dedicados, fácil integração nos sites dos clientes.
- Serviços de modelagem 3D precisos e personalizados, com customização e AR.
- Manutenção e atualizações contínuas.

**Projeto único:**
- Execução sob demanda com escopo definido, da modelagem à entrega dos embeds.
- Solução completa sem compromisso de longo prazo.
- Flexibilidade para migrar depois para o SaaS.

## 3. Como vencemos
- **Versatilidade na oferta**: SaaS para quem quer longo prazo, projeto único para quem quer algo pontual.
- **Tecnologia de ponta**: 3D e AR inovadores, intuitivos e fáceis de integrar.
- **Relacionamento de longo prazo**: parceria que melhora continuamente a apresentação e venda dos produtos; incentivo a upgrades.
- **Autoridade no mercado**: principal fornecedora de visualização para marcas de móveis, comunicando impacto em redução de custos, experiência do usuário e vendas.

> Planos e preços exibidos no portal ainda **não** estão em prática comercial. Fonte institucional: archtechtour.com.
`,
    ["estratégia", "proposta de valor", "saas"]),
  article("ka_comercial_clientes", "kb_comercial", "Cases e referências", 2, "Clientes e onde estão os materiais",
    `
Marcas atendidas (cadastro do portal): Escal, Estúdio Bola, Wentz, Minimal Design, RS Design, Tidelli, Hunter Douglas, Docol, Pedro Franco, DEXCO, WJ Luminárias, Christie, Cadeiras Rosa, Jader Almeida, Arctefacto, Green House, Persol, Riccó, Dengo Petlovers, Inkasa.

- Contratos: OneDrive → \`Contratos ATT\`; por cliente, o site SharePoint da marca (\`1 - Contrato\`).
- Materiais de marketing e imagens por cliente: site SharePoint da marca (\`2 - Materiais Marketing\`, \`5 - Imagens\`).
- Orçamentos e esboços de plataforma: SharePoint \`tech\` → \`2 - Produto e Tecnologia/Plataforma + Integração\`.
- Concorrentes / empresas do mercado: SharePoint \`tech\` → \`2 - Produto e Tecnologia/P&D\`.
- Números reais de uso por marca: aba **Analytics** do portal (Athena) — nunca inventar números em proposta.
`,
    ["clientes", "materiais"]),
];

const ARTIGOS_MARKETING_EXTRA: KbArticle[] = [
  article("ka_marketing_ferramentas_lista", "kb_marketing", "Ferramentas", 3, "Ferramentas e contas de marketing (onde está cada acesso)",
    `
Fonte: documento "Acessos ArchTechTour [Marketing]" (OneDrive do Palhano). **Senhas e códigos de recuperação não ficam aqui** — estão no documento original; peça acesso ao responsável.

| Ferramenta | Para quê | Onde está o acesso |
|---|---|---|
| Instagram \`@archtechtour\` | Perfil oficial | Documento de acessos (login da conta) |
| Facebook (página) e Gerenciador de Negócios / Anúncios | Página e campanhas | Convites por perfil; acesso principal no e-mail \`builders@archtechtour.com\` |
| LinkedIn (página) | Página institucional | Administradores: Matheus, Mariana, Fran |
| YouTube | Canal | Convites administrativos para Matheus e Mariana |
| Google Analytics | Métricas do site | Matheus é administrador geral |
| Hotjar e Microsoft Clarity | Comportamento do usuário no site (mapas de calor, gravações) | Administrador: Matheus |
| Google Ads e Looker | Campanhas e relatórios | Conta \`mktarchtechtour@gmail.com\` |
| E-mail de marketing | \`ssousa@archtechtour.com\` e \`mktarchtechtour@gmail.com\` (conta antiga com vários acessos) | Documento de acessos |
| RD Station | Landing pages (\`marketing.archtechtour.com\`) | — |
| Figma | Postagens, base de criativos, layout do customizador, layout de ads, **brandbook**, boneco da home, apresentações, padrões/selos do site | Arquivos no workspace do Figma (links no documento de acessos) |
| Canva | Cartão de visitas e peças avulsas | Links no documento de acessos |
| Google Drive | Lista atualizada de leads | Pasta compartilhada (link no documento de acessos) |
`,
    ["ferramentas", "acessos", "redes sociais"]),
  article("ka_marketing_brandbook", "kb_marketing", "Identidade visual", 2, "Onde está o brandbook e os arquivos de marca",
    `
- **Brandbook ArchTechTour** e a base de criativos estão no **Figma** (arquivos "Brandbook / Propostas", "Base Criativos ArchTechTour", "Padrões – Selos ArchTechTour – Site").
- Peças de apresentação: OneDrive do Palhano → \`Att_Product.pptx\`; SharePoint \`tech\` → apresentações por marca (ex.: \`AF_Minimal_Minisalas.pptx\`).
- Anexe neste artigo (ou no artigo "Identidade visual da ArchTechTour") os PDFs do manual e os logos oficiais — assim quem não tem Figma encontra aqui.
`,
    ["marca", "figma", "brandbook"]),
];

// ------------------------------------------------------------
// ARTIGOS — Manuais de processos (OneDrive ARX LIMITED → Documentos →
// 3 - Archtechtour → 11 - Manual de processos). Os PDFs/DOCX originais foram
// anexados aos artigos (chaves em KB_ATTACHMENTS, já no S3 em kb/).
// ------------------------------------------------------------
const MANUAIS_PASTA = "OneDrive ARX LIMITED → Documentos → 3 - Archtechtour → 11 - Manual de processos";

const ARTIGOS_MANUAIS: KbArticle[] = [
  article("ka_tech_manuais_index", TECH, "Manuais e padrões", 10, "Manuais de processos — índice",
    `
Os manuais oficiais da produção ficam na pasta **${MANUAIS_PASTA}**. Cada um virou um artigo nesta seção, com o arquivo original anexado.

| Pasta | Documento | Artigo |
|---|---|---|
| 1 - Manual individual modeladores_Dev | Manual Desenvolvedor Liles | Manual do desenvolvedor (Verge3D) |
| 1 - Manual individual modeladores_Dev | Manual modelador Victor / Igor / Ezequiel | Manual do modelador |
| 2 - Manual e Processos ATT | Padrões de Texturização | Padrões de texturização |
| 2 - Manual e Processos ATT | Requisitos de nomenclatura para materiais e texturas | Nomenclatura de materiais e texturas |
| 2 - Manual e Processos ATT | Limpeza de arquivos antes da exportação | Limpeza de arquivos antes da exportação |
| 2 - Manual e Processos ATT | Manual Técnico / Runbook / Documentação Técnica dos Customizadores (AWS) | Base de TI → Infraestrutura dos customizadores (AWS) |
| 2 - Manual e Processos ATT | Manual de Boas Práticas (comercial/administrativo, 24/10/2024) | Base Comercial → Rotina comercial e administrativa |
| raiz | Manual Técnico de Setup — Orquestrador de Automação BIM | Automação BIM: FBX → OBJ + IFC |

| 2 - Manual e Processos ATT | Otimização de arquivos para web e AR + Técnicas de otimização 3D | Otimização de malhas e arquivos para web e AR |
| 2 - Manual e Processos ATT | Boas Práticas 3D: Blender + 3ds Max | Colaboração Blender + 3ds Max |
| 2 - Manual e Processos ATT | Procedimentos para modelagem de móveis | Procedimentos para modelagem de móveis |
| 2 - Manual e Processos ATT | Integração do plugin SimLab para o SketchUp | Importar FBX no SketchUp (plugin SimLab) |
| 2 - Manual e Processos ATT | Documentação do Processo: Dados AWS (jul/2025) | Base de TI → Histórico: integração do tracking no customizador |
| 3 - Ouro | Documentação Técnica 3D_WebDev + Customizador Verge3D Frontend | Front-end do customizador (estrutura de código) |

Todos os 21 documentos da pasta estão importados (o "Padrões de Texturização (1)" é cópia do original).
`,
    ["manuais", "índice"]),

  article("ka_tech_manual_modelador", TECH, "Manuais e padrões", 11, "Manual do modelador: pré-produção, modelagem, UV, texturização e checagem",
    `
Consolidado dos manuais individuais dos modeladores (originais em anexo).

## 1. Pré-produção — juntar o máximo de informação
- **Imagens de referência**: frontal, lateral, superior, perspectiva e close-ups de costuras e acabamentos. É a etapa que mais influencia tempo e assertividade — evita ajustes depois.
- Conferir medidas gerais. Desenhos técnicos costumam ser ilustrativos e o modelo 3D do cliente raramente tem qualidade (malha, texturas, mapeamento).
- Baixar os \`.skp\` da marca, texturas e referências; verificar se falta algo; criar a pasta do projeto no App Manager do Verge3D.

## 2. Modelagem
- Começar **simples e modular** (cada forma pode precisar de alteração), das formas gerais para o detalhe.
- Modelar o fluxo da geometria pensando em cortes e loops de costura — facilita o mapeamento realista dos acabamentos.
- Nem polígonos demais (desempenho) nem de menos (efeito "quadrado"). **Quanto mais low poly, melhor.** Manter histórico/etapas para o modelo não ficar "colapsado".
- Retopologia quando o \`.skp\` permitir; modelagem do zero quando não.
- Se for o primeiro modelo da marca, organizar o \`.blend\` no padrão e usá-lo como **template** para os demais.
- Cada modelador é responsável pelo seu modelo do início até a aprovação final do cliente — trocar de artista no meio dos ajustes vira caos.

## 3. UV (mapeamento)
- Menos cortes e menor distorção possível; esconder os cortes.
- Conferir escala e **orientação** das UVs — errado aqui, a textura aparece distorcida e irreal.

## 4. Texturização
- Trabalhar as texturas junto do produto de validação; só as que ele usa (as demais antes de enviar ao programador).
- Remover emendas no PixPlant 5; ajustar cor/tamanho (madeira costuma precisar); se a textura da marca não serve (resolução, repetição evidente), buscar a mais parecida; Substance Painter só em casos especiais.
- Organizar no \`.blend\`: materiais, parâmetros de shader, repetições, normal map. Respeitar tonalidade, saturação e intensidade de reflexo das referências.

## 5. Setup Verge3D (feito junto da modelagem)
Iluminação, câmera, limite de zoom, parâmetros que aparecem no visualizador; verificação final de escala e nomenclatura; exportar e subir no Drive.

## 6. Checar o resultado
Formas e proporções contra as referências; orientação das UVs; preparar arquivos para upload.
`,
    ["modelagem", "uv", "texturização", "manual"]),

  article("ka_tech_manual_dev", TECH, "Manuais e padrões", 12, "Manual do desenvolvedor (Verge3D, Puzzles, AR e publicação)",
    `
Resumo do manual do desenvolvedor (original em anexo).

## Fluxo
1. **Modelo 3D** no Blender com UVs corretas e materiais atribuídos por parte do produto.
2. **Exportar para Verge3D** com o plugin do Blender (\`.glb\`/\`.html\`); abrir o projeto no App Manager.
3. **Interatividade com Puzzles**: expor os objetos que trocam material/textura; blocos principais "Quando clicado", "Obter objeto", "Definir material", "Trocar textura", "Carregar imagem" (texturas dinâmicas). UI em HTML/CSS (botões, menus) aciona as trocas.
4. **Variantes**: texturas na pasta do projeto; materiais alternativos configurados no Blender.
5. **AR** via WebXR: modelo otimizado para tempo real; Puzzles "Entrar/Sair do modo AR"; âncoras quando o modelo precisa ficar fixo.
6. **Publicação**: testar no App Manager; hospedar na AWS (S3 + CloudFront); garantir otimização para celular, onde o AR é mais usado.
7. **Testar AR** em dispositivos ARCore/ARKit reais; conferir que as trocas funcionam no viewer e no AR.

## Otimização de desempenho
Malha e topologia enxutas; compressão de texturas; LOD; batching de malhas; frustum culling; atlas de texturas; carregamento assíncrono de recursos grandes; refatoração e profiling dos scripts.

## UX
Controles intuitivos, feedback visual nas interações, tooltips explicando cada elemento.
`,
    ["verge3d", "puzzles", "ar", "manual"]),

  article("ka_tech_texturizacao", TECH, "Texturização e materiais", 13, "Padrões de texturização (web e AR)",
    `
Original em anexo. Regras para texturas leves e rápidas nos customizadores:

1. **Resolução**: a menor aceitável; sempre **potência de dois** (512, 1024…); alta resolução só onde o detalhe importa.
2. **Formato**: JPEG para fotográficas sem transparência (ajustar compressão); PNG só com transparência; WebP se o Verge3D suportar. Comprimir (Photoshop, GIMP, TinyPNG…).
3. **Atlas de texturas** para reduzir arquivos e draw calls; *baking* de luz/sombra/AO numa textura quando aplicável.
4. **Remover canais inúteis**: RGB em vez de RGBA sem alpha; bump/normal/rugosidade em escala de cinza.
5. **Compressão no Verge3D**: opções de qualidade JPEG / nível PNG no App Manager.
6. **UV eficiente**: reaproveitar espaço, sobrepor UVs de partes que compartilham textura, bom empacotamento.
7. **Mipmaps** habilitados; leve desfoque antes de exportar evita artefatos à distância.
8. **Normal/bump**: comprimidos; detalhes pequenos "bakeados" na difusa.
9. **Ferramentas**: ImageMagick, OptiPNG, ImageOptim, GIMP; scripts para lotes.
10. **Testar**: App Manager ou DevTools (F12) para medir download; reutilizar texturas entre objetos; preferir texturas *tileáveis*.

> Lembrete do pipeline: evitar node de mapping no Blender — não funciona em AR no iPhone.
`,
    ["texturas", "otimização", "padrões"]),

  article("ka_tech_nomenclatura", TECH, "Texturização e materiais", 14, "Nomenclatura de materiais e texturas",
    `
Original em anexo. Nome ruim (\`Material.001\`, \`Default\`, \`Lambert2\`) é a dor nº 1 da programação — Puzzles quebram por nome.

## Regras
1. **Consistência**: \`madeira_carvalho_escura\`, \`metal_aluminio_escovado\`, \`vidro_fosco_opaco\`. Texturas com tipo + detalhe: \`piso_madeira_normal\`, \`metal_arranhado_rugosidade\`.
2. **Sufixo por mapa**: \`_difusa\`/\`_basecolor\`, \`_normal\`, \`_rugosidade\`/\`_specular\`/\`_gloss\`, \`_height\`/\`_bump\`. Sem espaços (underscore ou camelCase).
3. **Agrupar por categoria**: Metal, Vidro, Madeira, Tecido (e subcategorias: Madeira/Clara, Metal/Polido…).
4. **Nomes únicos**; versões com \`_v01\`, \`_v02\`.
5. **Diretório de texturas** organizado por material (\`/Texturas/Madeira/carvalho_difusa.png\`), caminhos **relativos** ao projeto.
6. **Slots de material** com nomes claros (Frente, Verso, Bordas).
7. **Rotular mapas UV** (\`UV_MesaMadeira\`).
8. **Biblioteca de materiais** reutilizável, com a mesma estrutura de pastas.
9. **Documentar** configurações de material em projetos complexos (cor, caminhos, shader).
10. Miniaturas de pré-visualização quando o software suportar.
11. **Grupos de nós** nomeados (\`GrupoAcabamentoMadeira\`) com entradas/saídas claras.
12. **Sem duplicados** — mesclar materiais equivalentes.
13. Pensar na exportação: formatos comuns (\`.jpg\`, \`.png\`, \`.tiff\`) e nomes portáveis.

Padrão resumido usado na ATT: \`material_acabamento_codigo\`, textura com o mesmo nome do material.
`,
    ["nomenclatura", "materiais", "texturas"]),

  article("ka_tech_limpeza_export", TECH, "Checklist de qualidade e publicação", 15, "Limpeza de arquivos antes da exportação",
    `
Original em anexo. Checklist antes de exportar para o Verge3D (ou qualquer destino):

1. **Excluir o que não é usado**: objetos, malhas, câmeras, luzes; conferir objetos ocultos e camadas.
2. **Otimizar geometria**: remover N-gons (converter em quads/tris); reduzir densidade (decimate/retopologia); mesclar vértices duplicados; unificar normais.
3. **Escala e alinhamento**: aplicar transformações (escala 1, rotação 0, posição 0); pivô centralizado ou na base (móveis); unidades corretas (m/cm).
4. **Hierarquia e nomes**: nomes significativos para objetos, grupos e materiais; hierarquia limpa; remover materiais sem uso.
5. **Luz e câmera**: remover as desnecessárias; ajustar iluminação padrão se o viewer usa a própria.
6. **Animações**: apagar keyframes não usados; timeline com início/fim corretos.
7. **Formato**: GLTF/GLB para web (Verge3D); FBX para engines/outros softwares; OBJ para modelos simples. Exportar só o necessário (geometria, texturas, animações).
8. **Testar no destino** (Verge3D) e procurar erros/artefatos.
9. **Tamanho**: reduzir textura, simplificar geometria, remover metadados.
`,
    ["exportação", "checklist", "blender"]),

  article("ka_ti_custom_infra", TI, "Customizadores (AWS)", 30, "Infraestrutura dos customizadores (S3, CloudFront, API Gateway, Lambda, Athena)",
    `
Consolidado do Manual Técnico, do Runbook e da Documentação Técnica dos customizadores (originais em anexo). Complementa o artigo "Pipeline de analytics (Athena)".

## Arquitetura (100 % serverless)
\`\`\`
Usuário → CloudFront → S3 (customizador estático)
Customizador → API Gateway → Lambda → S3 (eventos JSON year/month/day) → Athena → Portal / Power BI
CloudFront logs → S3 → Athena
\`\`\`
- **S3**: buckets de publicação (\`explorar.archtechtour.com\`; legados \`bra-sao\`, \`demo-bra\`) com \`index.html\` + \`assets/{js,css,images,models}\`; bucket de logs/eventos. Leitura pública, escrita só por serviços AWS.
- **CloudFront**: CDN, cache e **fonte oficial de logs de acesso** (timestamp, URL, IP, UA, HTTP, bytes), particionados por data.
- **API Gateway**: recebe eventos (abertura, interações, cliques, downloads, finalização) via POST JSON — \`{event, cliente, produto, timestamp, page_url}\`. Endpoint público, protegido por CORS e validação na Lambda; sem autenticação (modelo de tracking).
- **Lambda**: valida, normaliza, enriquece (cliente a partir da URL) e grava em S3 particionado.
- **Athena**: tabelas externas sobre logs e eventos + views para BI.

## Estrutura obrigatória de URL
\`/<cliente>/<produto>/index.html\` (ex.: \`/jader-ver-20/cadeira-doty/\`, \`/dengo/lady/\`). **O primeiro segmento identifica o cliente** e é usado em relatórios, agrupamento e atribuição de marca. **Nunca quebrar esse padrão.**

## Publicar um customizador
1. Criar a pasta \`/cliente/produto/\`.
2. Ajustar o \`index.html\`: \`<title>\` correto e scripts de tracking ativos.
3. Upload para o S3; conferir via CloudFront.
4. Validar logs de acesso, eventos chegando no S3 e dados visíveis no Athena.

## Boas práticas
- Nunca quebrar o padrão de URL; sempre o primeiro path como cliente.
- Validar tracking **antes** de publicar; manter assets otimizados; evitar hardcode de ambiente (prod/dev).
- **Nunca consultar o Athena sem filtro de partição.**

## Troubleshooting
| Sintoma | Onde olhar |
|---|---|
| Sem logs de acesso | CloudFront (logging da distribuição) |
| Eventos não registrados | API Gateway / Lambda (payload, CORS) |
| Dados incompletos | schema JSON do evento |

> No portal atual o fluxo evoluiu: eventos crus vão para \`eventos_customizador\`, o ETL diário gera \`eventos_parquet\`, e o dashboard do portal lê o cache em \`archtechtour-assets/analytics-cache\`. Ver "Pipeline de analytics (Athena)".
`,
    ["aws", "customizadores", "cloudfront", "athena"]),

  article("ka_comercial_rotina", "kb_comercial", "Propostas e contratos", 3, "Rotina comercial e administrativa (manual de boas práticas)",
    `
Do "Manual de Boas Práticas" de 24/10/2024 (original em anexo). Rotina diária de quem atende o comercial/administrativo.

## Início do dia
Abrir WhatsApp Web, Notion, RD Station, e-mail, Google Agenda, Google Drive e a folha de ponto (Drive).

## WhatsApp
Primeira tarefa: ver e responder tudo. Usar as **mensagens prontas** (digitar \`/\`) para dúvidas frequentes e follow-ups.

## E-mail
Revisar tudo; excluir o irrelevante, arquivar o respondido. **Boletos e notas fiscais** vão para a pasta certa no Drive com o padrão:
- Boletos: \`AnoMêsDia - Boleto ACATE - BRLXXX\`
- Notas fiscais: \`AnoMêsDia - NF nºXXXX - BRLXXX\`

## RD Station
Marcar tarefas concluídas, criar novas; reuniões agendadas viram tarefas; follow-ups também. Novos leads/contatos entram com empresa + contato (extensão do WhatsApp ajuda).

## Contratos
- Modelos em \`ARCHTECHTOUR > Administrativo > Modelos\`: **copiar** o modelo (nunca editar o original) e alterar só as partes em amarelo.
- Envio para assinatura pelo **D4Sign**, com os e-mails da diretoria em cópia e o do cliente.

## Pós-reunião de apresentação
Criar grupo no WhatsApp "**Nome da Empresa | ArchTechTour**" com os contatos da empresa; enviar o link do formulário de coleta para a proposta; acompanhar as respostas.

## Agenda
Conferir as reuniões do dia no Google Agenda e mandar os links no grupo do comercial com antecedência.
`,
    ["rotina", "rd station", "contratos", "atendimento"]),
];

const ARTIGOS_MANUAIS_2: KbArticle[] = [
  article("ka_tech_frontend_customizador", TECH, "Programação do customizador (Verge3D)", 16, "Front-end do customizador: estrutura de código e regra de ouro",
    `
Consolidado das duas documentações técnicas do front-end (originais em anexo). O customizador é uma aplicação web **estática** em Verge3D: cena exportada do Blender, interação via Puzzles, UI e regras de negócio em JavaScript. **Não existe backend** — só as chamadas opcionais de tracking.

## Estrutura do projeto
\`\`\`
/
├─ index.html          bootstrap
├─ app.js              inicialização do Verge3D (template — sem regra de negócio)
├─ v3d.js              engine
├─ visual_logic.js     gerado pelos Puzzles — NUNCA editar à mão
├─ visual_logic.xml
├─ puzzles.js
├─ media/models/*.gltf|*.bin   media/textures/
└─ assets/script/main.js       lógica da UI / customização
   assets/script/texture-data.js   catálogo de materiais e texturas (só descreve opções)
   assets/css/  assets/images/
\`\`\`
Ordem de carga no \`index.html\`: **v3d.js → app.js → visual_logic.js → texture-data.js → main.js**.

## Comunicação UI → 3D (regra central)
\`UI (main.js) → puzzles.procedures.* → cena 3D\`. Exemplo: \`puzzles.procedures.changeTexture("Material_Madeira", item.texture)\`. Troca de módulo: \`changeModel("Modulo_A")\` (o módulo precisa existir no \`.gltf\` e ser controlado por Puzzle hide/show). AR: \`enterAR()\` / \`exitAR()\` — exige HTTPS, dispositivo compatível e cena low poly.

## Convenções obrigatórias no Blender
- Nome do material no Blender **= nome usado no Puzzle** (\`Material_Madeira\`, \`Material_Tecido\`).
- Objetos que mudam devem estar expostos no Verge3D, sem nomes genéricos (\`Cube.001\`).

## Performance (obrigatório)
Texturas 512–2048 px em JPG/KTX2; GLTF com Draco quando possível; evitar múltiplos materiais; no código, sem listeners duplicados, sem recarregar textura à toa, reutilizar estados.

## Checklist do desenvolvedor
Antes: entender o \`.blend\`, conferir nomes de materiais, abrir o projeto no App Manager. Para customizar: lógica no Puzzle → exportar cena → chamar \`puzzles.procedures.*\` no JS → UI no \`main.js\`. Para publicar: testar local, mobile e AR; console com **0 erros**.

> **Regra de ouro:** o Verge3D controla o 3D; o JavaScript controla o produto. Eles nunca se misturam — quebrar essa separação degrada o projeto rápido.
`,
    ["verge3d", "front-end", "puzzles", "main.js"]),

  article("ka_tech_otimizacao", TECH, "Modelagem de produto", 17, "Otimização de malhas e arquivos para web e AR",
    `
Consolidado de "Otimização de arquivos para web e AR" e "Técnicas de otimização 3D" (originais em anexo).

## Polígonos
- **Decimação** (Decimate no Blender, ProOptimizer no 3ds Max) e **retopologia** manual onde o detalhe importa.
- **LOD**: versões alta/média/baixa trocadas pela distância da câmera.
- Simplificar áreas planas, colapsar arestas, remover geometria oculta/interna e não-manifold, menos segmentos em cilindros/esferas, loops de aresta só onde sustentam a forma. Quads em vez de triângulos; triangular só quando o motor exigir.
- **Instâncias/proxies** para objetos repetidos; unir malhas pequenas para reduzir draw calls.

## Texturas e materiais
- Resolução mínima aceitável (512/1024 para peças pequenas); JPG/WebP para cor, PNG só com alpha, **KTX2/Basis** para normais e compressão web; atlas para reduzir materiais; mipmaps.
- **PBR** (albedo, normal, roughness, metallic, AO) — detalhe por normal map em vez de geometria; *bake* de AO/sombras/iluminação em cenas estáticas; iluminação dinâmica só quando a interação exigir.
- UV compacta, sem esticar, mínimo de costuras; sobreposição só em partes simétricas.

## Formatos
- **GLTF/GLB** para web e AR (Draco para geometria); **USDZ** para AR no iOS (ARKit); OBJ só para modelos simples; FBX precisa ser convertido para GLTF na web.
- Animações: rigs simples, keyframes reduzidos, *bake* sempre que possível.

## Ferramentas
Blender (Decimate, UVPackMaster), Simplygon, glTF Pipeline, Draco, MeshLab, Substance Painter (bake), Sketchfab (prévia). Medir com Lighthouse, WebPageTest e WebGL Insights; testar AR em aparelhos fracos.

## Boas práticas gerais
Guardar sempre o modelo original em alta; usar wireframe/contador de polígonos; conferir o desempenho no ambiente de destino com frequência.
`,
    ["otimização", "low poly", "gltf", "ar"]),

  article("ka_tech_colaboracao_blender_max", TECH, "Modelagem de produto", 18, "Colaboração Blender + 3ds Max",
    `
Original em anexo. Quando parte da equipe modela no 3ds Max e o setup Verge3D é feito no Blender:

1. **Formatos de troca**: FBX, OBJ ou GLTF (preservam geometria, UV e materiais básicos); versões de software compatíveis.
2. **Biblioteca compartilhada** de modelos, texturas e materiais, com convenção de nomes e versões.
3. **Mesma unidade** nos dois softwares (metros/centímetros) para o modelo não mudar de tamanho.
4. **Revisão** por capturas/renders antes de finalizar.
5. **Controle de versão**: guardar o low poly antes da subdivisão junto da versão final no Drive.
6. **Chegar no Blender só com o necessário**: geometria separada por tipo de material, UV aberta, objeto e origem centralizados, normais corretas, escala correta, sem keyframes ou materiais extras.
7. **Shaders só no Blender**, simplificados: Base Color + Normal Map no Principled BSDF.
8. **Documentar** fluxo, configurações de export/import e soluções de problemas (esta base).
`,
    ["blender", "3ds max", "colaboração"]),

  article("ka_tech_procedimentos_moveis", TECH, "Modelagem de produto", 19, "Procedimentos para modelagem de móveis",
    `
Original em anexo. Roteiro geral (do conceito à exportação):

1. **Design conceitual** — dimensões exatas e proporções (ergonomia quando aplicável); imagens de referência.
2. **Modelagem** — formas primitivas → poligonal (vértices/arestas/faces); NURBS para curvas complexas; escultura para orgânicos; modificadores (chanfro, subdivisão, array).
3. **Detalhamento e otimização** — puxadores, parafusos, bordas, almofadas, costuras; chanfros; decidir low poly (tempo real) × high poly (render); suavização/subdivisão; abrir UV.
4. **Texturização e materiais** — mapas de cor, bump, normal, roughness; materiais PBR; atribuir madeira/metal/tecido por componente.
5. **Iluminação e câmera** — HDRI para ambiente realista; câmera em ângulos que mostrem o produto; anti-aliasing, AO, GI.
6. **Render e pós** — correção de cor e profundidade de campo quando necessário.
7. **Visualização interativa** — importar no Verge3D (ou Unity/Unreal), trocas de textura/dimensões, otimizar para tempo real.
8. **Garantia de qualidade** — erros de malha, faces sobrepostas, distorção de textura; renders de teste; ciclo de feedback com o cliente.
9. **Exportação final** — FBX/OBJ/GLB conforme o destino; documentação técnica, lista de materiais e referências quando for para produção.
`,
    ["modelagem", "móveis", "procedimento"]),

  article("ka_tech_simlab", TECH, "Blocos BIM (ArchiCAD / Revit / SketchUp)", 20, "Importar FBX no SketchUp (plugin SimLab)",
    `
Original em anexo. Para levar o modelo (FBX) ao SketchUp e gerar o bloco \`.skp\`:

1. **Instalar** o *SimLab FBX Importer* (site da SimLab Soft) na versão compatível com o seu SketchUp.
2. **Carregar no SketchUp**: Janela → Gerenciador de Extensões → Instalar Extensão (arquivo \`.rbz\`); o plugin aparece no menu Extensões.
3. **Importar**: Extensões → SimLab FBX Importer → escolher o \`.fbx\`.
4. **Ajustar** escala, unidades e camadas nas opções do importador, se necessário.
5. **Testar** com um FBX de exemplo e conferir geometria, materiais e texturas.

> Alternativa automática: a Automação BIM gera OBJ/MTL (para SketchUp) e IFC (Revit/ArchiCAD) a partir do FBX — ver o artigo "Automação BIM".
`,
    ["sketchup", "fbx", "simlab", "bim"]),

  article("ka_ti_tracking_historico", TI, "Customizadores (AWS)", 31, "Histórico: integração do tracking no customizador (jul/2025)",
    `
Registro de 10–11/07/2025 de como o rastreamento de eventos foi ligado (original em anexo). É a origem do pipeline descrito em "Infraestrutura dos customizadores" e "Pipeline de analytics".

1. **Lambda** (Node.js) para registrar os eventos do customizador; cada evento salvo com nome que inclui data e tipo de ação.
2. Testes pelo console da AWS simulando eventos e conferindo os arquivos no bucket.
3. **API Gateway**: rota \`POST /register-event\` chamando a Lambda; ajuste de região e **CORS** liberado para o customizador hospedado no S3.
4. Testes de integração com Postman e com o próprio customizador (API Gateway → Lambda → S3).
5. **Customizador HTML/JS**: \`fetch\` para o endpoint nos eventos de download, clique no WhatsApp, abertura de AR e um novo evento de **checkout (carrinho)** com as variações escolhidas — modelo entregue para o programador integrar aos botões.
6. Fluxo completo validado; dados prontos para Athena/Power BI.
7. Risco anotado: acúmulo de arquivos no S3 → agrupar eventos por dia ou migrar para banco quando o volume crescer.
8. Próximos passos na época: garantir que a seleção de base/metais entre nos eventos; passo a passo de análise no Athena; documentar para o comercial.

> Evolução desde então: eventos crus em \`eventos_customizador\`, ETL diário para \`eventos_parquet\`, dashboard no portal. Pendência que ficou: \`session_id\` só no \`session_start\`.
`,
    ["tracking", "histórico", "api gateway", "lambda"]),
];

/** Anexos importados da pasta de manuais (objetos já no S3, prefixo kb/). */
const att = (id: string, key: string, name: string, size: number, type: string): KbAttachment => ({
  id, key, name, size, type, uploadedAt: T0, uploadedBy: "import-onedrive",
});
const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const KB_ATTACHMENTS: Record<string, KbAttachment[]> = {
  ka_comercial_rotina: [att("kf_com_rotina", "kb/kb_comercial/ka_comercial_rotina/1788898816768_Manual_de_Boas_Praticas_Comercial_Admin_2024-10-24.pdf", "Manual_de_Boas_Praticas_Comercial_Admin_2024-10-24.pdf", 102981, PDF)],
  ka_tech_bim_automacao: [att("kf_bim_setup", "kb/kb_tech/ka_tech_bim_automacao/1788898818242_Manual_Tecnico_Setup_Orquestrador_Automacao_BIM.docx", "Manual_Tecnico_Setup_Orquestrador_Automacao_BIM.docx", 17674, DOCX)],
  ka_tech_limpeza_export: [att("kf_limpeza", "kb/kb_tech/ka_tech_limpeza_export/1788898819115_Limpeza_de_arquivos_antes_da_exportacao.pdf", "Limpeza_de_arquivos_antes_da_exportacao.pdf", 62717, PDF)],
  ka_tech_manual_dev: [att("kf_dev_liles", "kb/kb_tech/ka_tech_manual_dev/1788898820131_Manual_Desenvolvedor_Liles.pdf", "Manual_Desenvolvedor_Liles.pdf", 87619, PDF)],
  ka_tech_manual_modelador: [
    att("kf_mod_victor", "kb/kb_tech/ka_tech_manual_modelador/1788898825026_Manual_Modelador_Victor.pdf", "Manual_Modelador_Victor.pdf", 66048, PDF),
    att("kf_mod_igor", "kb/kb_tech/ka_tech_manual_modelador/1788898824072_Manual_Modelador_Igor.pdf", "Manual_Modelador_Igor.pdf", 65393, PDF),
    att("kf_mod_ezequiel", "kb/kb_tech/ka_tech_manual_modelador/1788898821250_Manual_Modelador_Ezequiel.pdf", "Manual_Modelador_Ezequiel.pdf", 2954503, PDF),
  ],
  ka_tech_nomenclatura: [att("kf_nomenclatura", "kb/kb_tech/ka_tech_nomenclatura/1788898826077_Requisitos_de_nomenclatura_materiais_e_texturas.pdf", "Requisitos_de_nomenclatura_materiais_e_texturas.pdf", 120000, PDF)],
  ka_tech_texturizacao: [att("kf_texturizacao", "kb/kb_tech/ka_tech_texturizacao/1788898827348_Padroes_de_Texturizacao.pdf", "Padroes_de_Texturizacao.pdf", 68215, PDF)],
  ka_ti_custom_infra: [
    att("kf_infra_manual", "kb/kb_ti/ka_ti_custom_infra/1788898829406_Manual_Tecnico_Infraestrutura_de_Customizadores.pdf", "Manual_Tecnico_Infraestrutura_de_Customizadores.pdf", 141871, PDF),
    att("kf_infra_runbook", "kb/kb_ti/ka_ti_custom_infra/1788898800154_Runbook_Tecnico_Customizadores_AWS.pdf", "Runbook_Tecnico_Customizadores_AWS.pdf", 4178, PDF),
    att("kf_infra_doc", "kb/kb_ti/ka_ti_custom_infra/1788898828708_Documentacao_Tecnica_Customizadores_Completo.pdf", "Documentacao_Tecnica_Customizadores_Completo.pdf", 4746, PDF),
  ],
  ka_tech_colaboracao_blender_max: [att("kf_colab_blender_max", "kb/kb_tech/ka_tech_colaboracao_blender_max/1788899606908_Boas_Praticas_3D_Blender_e_3ds_Max.pdf", "Boas_Praticas_3D_Blender_e_3ds_Max.pdf", 45005, PDF)],
  ka_tech_otimizacao: [
    att("kf_otimizacao_web_ar", "kb/kb_tech/ka_tech_otimizacao/1788899607882_Otimizacao_de_arquivos_para_web_e_AR.pdf", "Otimizacao_de_arquivos_para_web_e_AR.pdf", 97283, PDF),
    att("kf_otimizacao_tecnicas", "kb/kb_tech/ka_tech_otimizacao/1788899608976_Tecnicas_de_otimizacao_3D.docx", "Tecnicas_de_otimizacao_3D.docx", 18466, DOCX),
  ],
  ka_tech_procedimentos_moveis: [att("kf_proc_moveis", "kb/kb_tech/ka_tech_procedimentos_moveis/1788899609713_Procedimentos_para_modelagem_de_moveis.docx", "Procedimentos_para_modelagem_de_moveis.docx", 18018, DOCX)],
  ka_tech_simlab: [att("kf_simlab", "kb/kb_tech/ka_tech_simlab/1788899610464_Integracao_do_plugin_SimLab_para_o_SketchUp.pdf", "Integracao_do_plugin_SimLab_para_o_SketchUp.pdf", 56210, PDF)],
  ka_ti_tracking_historico: [att("kf_tracking_hist", "kb/kb_ti/ka_ti_tracking_historico/1788899611412_Documentacao_do_Processo_Dados_AWS_2025-07.docx", "Documentacao_do_Processo_Dados_AWS_2025-07.docx", 478171, DOCX)],
  ka_tech_frontend_customizador: [
    att("kf_front_webdev", "kb/kb_tech/ka_tech_frontend_customizador/1788899613164_Documentacao_Tecnica_Customizador_3D_WebDev.pdf", "Documentacao_Tecnica_Customizador_3D_WebDev.pdf", 3962520, PDF),
    att("kf_front_verge", "kb/kb_tech/ka_tech_frontend_customizador/1788899615219_Documentacao_Tecnica_Customizador_Verge3D_Frontend.pdf", "Documentacao_Tecnica_Customizador_Verge3D_Frontend.pdf", 5698, PDF),
  ],
};

const withAttachments = (r: KbRecord): KbRecord =>
  r.kind === "article" && KB_ATTACHMENTS[r.id] ? { ...r, attachments: KB_ATTACHMENTS[r.id] } : r;

export const KB_SEED: KbRecord[] = [
  ...KB_SEED_BASES, ...ARTIGOS_EQUIPE, ...ARTIGOS_TI, ...ARTIGOS_TI_SITE,
  ...ARTIGOS_TECH_EXTRA, ...ARTIGOS_COMERCIAL_EXTRA, ...ARTIGOS_MARKETING_EXTRA, ...ARTIGOS_MANUAIS, ...ARTIGOS_MANUAIS_2,
].map(withAttachments);
