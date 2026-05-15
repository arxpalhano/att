# Manual Técnico — Portal ArchTechTour

> **Para quem é**: equipe técnica da ArchTechTour. Use como referência quando algo quebrar em produção e o Matheus Palhano não estiver disponível.
>
> **Última atualização**: 2026-05-15
> **Versão**: 1.0

---

## Índice

1. [Visão geral & arquitetura](#1-visão-geral--arquitetura)
2. [Stack & infraestrutura](#2-stack--infraestrutura)
3. [Componentes do sistema](#3-componentes-do-sistema)
4. [Fluxos principais](#4-fluxos-principais)
5. [Operações comuns](#5-operações-comuns)
6. [Troubleshooting](#6-troubleshooting)
7. [Procedimentos críticos](#7-procedimentos-críticos)
8. [Referência rápida](#8-referência-rápida)

---

## 1. Visão geral & arquitetura

### O que é o portal

Portal web da ArchTechTour que serve dois públicos:
- **Clientes B2B** (RS Design, Tidelli, Jader Almeida, etc.) — acessam dashboards analytics dos seus produtos no customizador 3D + acompanham produção dos blocos contratados.
- **Equipe interna** — gerencia pipeline de produção de blocos 3D, aprovações, contratos, e dispara/monitora analytics.

### Arquitetura em uma página

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          USUÁRIOS                                        │
│  Clientes (RS Design, etc.)  +  Admins (Palhano, Mariana, etc.)          │
└─────────────────────────────┬────────────────────────────────────────────┘
                              │ HTTPS
                              ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                    AWS AMPLIFY HOSTING (sa-east-1)                       │
│                                                                          │
│   Next.js 14 (App Router) — SSR Compute Lambda                           │
│   • Páginas: login, dashboard cliente, dashboard interno, analytics      │
│   • API routes: /api/analytics/* /api/upload /api/analyze                │
│                                                                          │
│   IAM Role: amplify-archtechtour-portal-ssr                              │
│   Domínio: https://main.d20t94dp8646px.amplifyapp.com                    │
└──────┬──────────────────────────────────────────┬────────────────────────┘
       │ queries Athena                            │ read/write S3
       │ (cross-region us-east-1)                  │
       ↓                                          ↓
┌─────────────────────────────────┐  ┌────────────────────────────────────┐
│  AWS ATHENA (us-east-1)          │  │  AWS S3 (us-east-1)                │
│                                  │  │                                    │
│  Database: customizador_events   │  │  archtechtour-assets/              │
│  ├─ eventos_customizador (JSON)  │  │   ├─ analytics-cache/{alias}/      │
│  │  ↑ legado, ainda escrita      │  │   │   latest.json (dashboards)     │
│  ├─ eventos_parquet ← USADO      │  │   └─ uploads/ (assets blocos 3D)   │
│  │  particionado por dt          │  │                                    │
│  ├─ dim_client_alias             │  │  explorar.archtechtour.com/        │
│  └─ vw_* (views de agregação)    │  │   ├─ eventos/ (JSONs do tracking)  │
│                                  │  │   └─ athena-tmp/ (results dump)    │
└─────────────────────────────────┘  └────────────────────────────────────┘
       ↑                                          ↑
       │                                          │
       │ INSERT mensal                            │ writes events
       │ (dia 5)                                  │ (tempo real)
       │                                          │
┌─────────────────────────────────┐  ┌────────────────────────────────────┐
│  Lambda parquet-monthly-etl     │  │  Lambda RegistrarEventoLambdaV2    │
│  EventBridge: cron(0 3 5 * ?*)   │  │  API Gateway → customizador.html   │
│  Node 20 arm64, 256MB, 15min     │  │  (já existe há meses)              │
└─────────────────────────────────┘  └────────────────────────────────────┘
       │
       │ chama refresh
       │ (dia 10)
       ↓
┌─────────────────────────────────┐
│  Lambda analytics-compute       │
│  EventBridge: cron(0 3 10 * ?*) │
│  POSTs /api/analytics/X/refresh │
└─────────────────────────────────┘
```

### Fluxo de dados em 4 estágios

1. **Captura** (real-time): Usuário interage com customizador 3D → `customizador.html` chama API Gateway → Lambda `RegistrarEventoLambdaV2` → escreve `{timestamp}_evento.json` em `s3://explorar.archtechtour.com/eventos/`.

2. **Consolidação** (mensal — dia 5): Lambda `parquet-monthly-etl` migra os JSONs do mês anterior para a tabela Parquet particionada `customizador_events.eventos_parquet`. **Por quê**: Parquet + partitioning = queries 15-21× mais rápidas e 740× menos scan.

3. **Agregação** (mensal — dia 10): Lambda `analytics-compute` chama `POST /api/analytics/{alias}/refresh` pro Amplify pra cada cliente do `dim_client_alias`. O Amplify roda 8 queries Athena no Parquet, gera o JSON do dashboard e salva em `s3://archtechtour-assets/analytics-cache/{alias}/latest.json`.

4. **Visualização** (tempo real): Cliente abre o portal → Next.js lê o JSON do S3 → React/Recharts renderiza KPIs e gráficos.

---

## 2. Stack & infraestrutura

### Frontend / Portal

| Item | Valor |
|---|---|
| Framework | Next.js 14.2.5 (App Router) |
| Linguagem | TypeScript 5.x |
| UI | Tailwind CSS 3.4 + Lucide React + Recharts |
| Hosting | AWS Amplify Hosting Gen 1 |
| Region | sa-east-1 (São Paulo) |
| Build | Node 20.x arm64 |
| Runtime SSR | ECS Fargate (algumas rotas) + Lambda (outras) — Amplify abstrai |
| Auto-deploy | Push em `main` → Amplify build → 5-8 min |

### Backend de dados

| Item | Valor |
|---|---|
| Query engine | AWS Athena |
| Storage | AWS S3 |
| Region | us-east-1 (N. Virginia) — **cross-region** com Amplify |
| Database Athena | `customizador_events` |
| Tabela de eventos | `eventos_parquet` (Parquet, particionado por `dt`) |
| Tabela dim | `dim_client_alias` (alias → cliente) |

### Automação

| Item | Valor |
|---|---|
| Lambda dia 5 | `parquet-monthly-etl` — Node 20.x, 256MB, timeout 15min |
| Lambda dia 10 | `analytics-compute` — Node 20.x, 256MB, timeout 15min |
| Scheduler | EventBridge rules com cron expressions |
| Lambda real-time (legado) | `RegistrarEventoLambdaV2` — captura eventos do customizador |

### Identidade e segurança

| Item | Valor |
|---|---|
| IAM Role compartilhada | `amplify-archtechtour-portal-ssr` (ARN: `arn:aws:iam::891377125620:role/amplify-archtechtour-portal-ssr`) |
| Conta AWS | `891377125620` |
| Trust policy | Permite `lambda.amazonaws.com` + `amplify.amazonaws.com` |
| Permissões | Athena (full), Glue (read), S3 (archtechtour-assets + explorar.archtechtour.com) |

### Custos estimados (mensais)

| Serviço | Custo aproximado |
|---|---|
| Amplify Hosting | $3-8 (depende do tráfego) |
| Athena | <$1 (com Parquet — antes era $5-10) |
| S3 (storage + requests) | $2-5 |
| Lambdas (cron mensal) | $0.01 |
| **Total** | **~$5-15/mês** |

---

## 3. Componentes do sistema

### 3.1 Portal Next.js

**Repositório**: https://github.com/arxpalhano/att
**Branch produção**: `main` (auto-deploy)
**Branch dev**: `develop`

**Estrutura do código**:
```
src/
├── app/
│   ├── page.tsx              # Landing + login
│   ├── portal/page.tsx       # Portal interno (lazy load Portal.tsx)
│   ├── contrato/page.tsx     # Fluxo de contrato/onboarding cliente
│   ├── planos/page.tsx       # Página de planos comerciais
│   └── api/
│       ├── analytics/
│       │   ├── [client]/
│       │   │   ├── route.ts       # GET dashboard do S3
│       │   │   └── refresh/
│       │   │       └── route.ts   # POST re-roda Athena
│       │   └── clients/
│       │       └── route.ts       # GET dim + POST insert
│       ├── analyze/route.ts       # AI analysis de assets (Claude)
│       └── upload/route.ts        # Upload S3 com presigned URL
├── components/
│   ├── Portal.tsx                  # ROOT (3400 linhas) — toda navegação interna
│   ├── AnalyticsDashboard.tsx      # Renderização do dashboard cliente
│   └── AnalyticsClientsAdmin.tsx   # Tela admin de gerenciar dim
└── lib/
    ├── athena.ts                   # Helper runAthenaQuery
    ├── analytics-builder.ts        # 8 queries paralelizadas → JSON
    ├── aws-clients.ts              # Factories S3/Athena
    └── amplify-credentials.ts      # Hack: força ECS credential URI
```

### 3.2 Tabelas Athena

#### `customizador_events.eventos_parquet` (USADO)

Formato Parquet, particionado por `dt`. Localização: `s3://archtechtour-assets/eventos-parquet/`.

| Coluna | Tipo | Descrição |
|---|---|---|
| `evento` | string | tipo do evento (session_start, abrir_ar, download_modelo, etc.) |
| `produto` | string | slug do produto (ex: `rsdesign-arquibancada-aris`) |
| `categoria` | string | grupo do evento |
| `rotulo` | string | label específica (ex: `botao_ar`, `sketchup`) |
| `user_id` | string | UUID persistido em localStorage |
| `session_id` | string | UUID por sessão |
| `user_agent` | string | navegador |
| `referrer` | string | URL de origem |
| `ts` | bigint | timestamp Unix (segundos) |
| `pais`, `estado`, `cidade` | string | geolocalização (do IP) |
| `latitude`, `longitude` | double | coordenadas |
| `timezone` | string | fuso |
| `origem_trafego` | string | inbound source |
| `dt` (partition) | string | data YYYY-MM-DD (do `ts`) |

#### `customizador_events.eventos_customizador` (LEGADO)

Formato JSON, sem partitioning. Localização: `s3://explorar.archtechtour.com/eventos/`.
**Ainda escrita pela Lambda do customizador**, mas as views agora leem do Parquet. Mantida temporariamente como backup.

#### `customizador_events.dim_client_alias`

Mapeamento de aliases → nomes de clientes. Atualmente ~7 registros.

| Coluna | Exemplo |
|---|---|
| `alias` | `rsdesign` |
| `cliente` | `RS Design` |

#### Views

| View | O que faz |
|---|---|
| `vw_eventos_base_com_cliente` | UNION join do `eventos_parquet` com `dim_client_alias` — adiciona coluna `cliente` (legível) e `data_evento`. **Esta é a view base usada por todas as queries de analytics**. |
| `vw_eventos_por_produto` | Eventos agregados por produto |
| `vw_eventos_por_localizacao` | Eventos por cidade/estado/país |
| `vw_eventos_paginas` | Eventos com URL como label |
| `vw_origem_acesso` | Origem dos acessos (referrer) |
| `vw_usuarios_por_dia` | DAU |
| `vw_tempo_medio_aproximado` | Tempo médio por sessão (v1) |
| `vw_tempo_medio_aproximado_v2` | Tempo médio por sessão (v2 — mais precisa) |
| `vw_downloads_por_tipo` | Downloads por formato (Sketchup/Archicad/Revit) |

### 3.3 Buckets S3

| Bucket | Prefixo | Conteúdo |
|---|---|---|
| `archtechtour-assets` | `analytics-cache/{alias}/latest.json` | JSON do dashboard de cada cliente |
| `archtechtour-assets` | `eventos-parquet/dt=YYYY-MM-DD/` | Eventos em Parquet (Athena escreve aqui) |
| `archtechtour-assets` | `uploads/` | Arquivos enviados pelos clientes pro pipeline 3D |
| `explorar.archtechtour.com` | `eventos/{timestamp}_evento.json` | Eventos crus do customizador (legado) |
| `explorar.archtechtour.com` | `athena-tmp/` | Results temporários de queries Athena |
| `explorar.archtechtour.com` | `{cliente}/ver-{n}/{produto}/` | HTML dos customizadores 3D publicados |

### 3.4 Lambdas

| Lambda | Trigger | Region | Função |
|---|---|---|---|
| `RegistrarEventoLambdaV2` | API Gateway | sa-east-1 | Captura evento do customizador → grava JSON em S3 |
| `CorrigirIndexCustomizador` | manual | sa-east-1 | (helper antigo) |
| `parquet-monthly-etl` | EventBridge dia 5 03h UTC | us-east-1 | ETL JSON → Parquet do mês anterior |
| `analytics-compute` | EventBridge dia 10 03h UTC | us-east-1 | Refresh dashboards via /api/analytics/X/refresh |

> ⚠️ As duas últimas (`parquet-monthly-etl` e `analytics-compute`) ainda precisam ser **deployadas no console AWS**. Ver `PENDENTE.md` itens 2 e 3.

---

## 4. Fluxos principais

### 4.1 Cliente acessa seu dashboard

```
1. Cliente abre https://main.d20t94dp8646px.amplifyapp.com
2. Login (email + senha) → carrega user.role = "client"
3. Redirecionado para o portal do cliente
4. Sidebar → clica em "Analytics"
5. AnalyticsPage roda useEffect → fetch GET /api/analytics/clients
   ├─ Lista todos os dim_client_alias → mapeia user.clientId → alias correto
6. Renderiza <AnalyticsDashboard clientAlias={alias} canRefresh={false}>
7. AnalyticsDashboard roda useEffect → fetch GET /api/analytics/{alias}
   ├─ Tenta GET s3://archtechtour-assets/analytics-cache/{alias}/latest.json
   ├─ Se 404 → tenta arquivo local public/analytics-data/{alias}.json (cache build)
   ├─ Se ambos falham → estado vazio
8. Renderiza KPIs + gráficos (Recharts)
9. Cliente pode trocar período no date picker → re-fetch (mas SEM canRefresh, não re-roda Athena)
```

### 4.2 Admin gera dashboard novo

```
1. Admin loga → AnalyticsPage com isClient=false
2. Seletor de cliente popula via GET /api/analytics/clients
3. Admin seleciona "Arctefacto" (que ainda não tem dashboard)
4. Dashboard mostra estado vazio + botão "Gerar dashboard"
5. Admin clica → POST /api/analytics/arctefacto/refresh
   body: { inicio: "YYYY-MM-DD", fim: "YYYY-MM-DD" }
6. API route faz:
   a) Verifica alias existe no dim_client_alias (1 query Athena ~2s)
   b) Chama buildAnalytics(): 8 queries Athena em PARALELO (~5s)
   c) Salva resultado em S3 + filesystem local (Vercel ignora local)
7. Retorna JSON pro frontend → re-renderiza com dados frescos
8. Tempo total: 7-10s
```

### 4.3 Cron mensal automático

```
DIA 5, 03h UTC:
1. EventBridge dispara Lambda parquet-monthly-etl
2. Lambda calcula mês anterior (ex: rodando 5/jul → mês alvo abril)
3. Para idempotência: DROP partições do mês alvo se existirem
4. Roda 1 INSERT INTO eventos_parquet SELECT * FROM eventos_customizador
   WHERE timestamp em range do mês
5. ~40s de execução, scaneia ~17MB JSON, escreve ~1MB Parquet
6. CloudWatch loga sucesso

DIA 10, 03h UTC:
1. EventBridge dispara Lambda analytics-compute
2. Lambda lista clientes ativos do dim_client_alias (1 query)
3. Para cada cliente: POST /api/analytics/{alias}/refresh
   { inicio: "mês anterior dia 1", fim: "mês anterior último dia" }
4. Aguarda response (até 30s/cliente)
5. Loga sucesso/falha por cliente no CloudWatch

DIA 11+:
- Clientes abrem o portal e veem dashboards atualizados
- Zero ação humana
```

---

## 5. Operações comuns

### 5.1 Adicionar cliente novo no dim_client_alias

**Via UI admin** (recomendado):
1. Logar como admin → menu Analytics → botão "Gerenciar clientes"
2. Clicar "Adicionar cliente" (canto superior direito)
3. Preencher:
   - **Alias**: prefixo dos produtos no customizador (ex: `novocli` para produtos como `novocli-cadeira-x`)
   - **Cliente**: nome legível (ex: `Novo Cliente Ltda`)
4. Confirmar — faz `INSERT INTO customizador_events.dim_client_alias` via Athena
5. Clicar "Gerar" na linha do cliente novo → dashboard primário criado

**Via Athena console** (caso UI esteja quebrada):
```sql
INSERT INTO customizador_events.dim_client_alias (alias, cliente)
VALUES ('novocli', 'Novo Cliente Ltda');
```

### 5.2 Forçar refresh de um cliente

**Via UI admin**:
1. Analytics → seleciona cliente → botão "Atualizar"
2. Aguarda 6-10s
3. Dashboard atualiza com dados frescos

**Via curl direto** (útil pra debug):
```bash
curl -X POST https://main.d20t94dp8646px.amplifyapp.com/api/analytics/rsdesign/refresh \
  -H "Content-Type: application/json" \
  -d '{"inicio":"2026-04-01","fim":"2026-04-30"}'
```

### 5.3 Ver logs do dia mensais

CloudWatch Logs → procurar:
- `/aws/lambda/parquet-monthly-etl` (dia 5)
- `/aws/lambda/analytics-compute` (dia 10)
- `/aws/amplify/d20t94dp8646px/main` (logs do SSR Lambda do portal)

### 5.4 Workflow de branches (importante!)

```
main     → PRODUÇÃO. Amplify auto-deploya a cada push.
develop  → DESENVOLVIMENTO. Sem deploy automático.
```

**Regra:** nunca commitar direto no `main`. Sempre desenvolver em `develop`:

```bash
git checkout develop
# faz alteração, testa local com npm run dev
git add . && git commit -m "..."
git push origin develop
```

Quando validado em `develop` (local e/ou outra revisão), promover pra produção:

```bash
# Opção A — PR no GitHub (recomendado, deixa histórico revisável)
# Abre PR develop → main em:
#   https://github.com/arxpalhano/att/compare/main...develop

# Opção B — merge local + push (rápido, sem PR)
git checkout main
git pull origin main           # garante main atualizada
git merge --ff-only develop    # falha se houver merge complexo → use PR
git push origin main
git checkout develop           # volta pra branch de trabalho
```

Após push em `main`: Amplify detecta → build → deploy → ~5-8 min até estar live.

**Rollback** caso algo quebre em prod: Amplify Console → app → branch `main` → na lista de builds, clica `⋯` na versão anterior → **Redeploy this version**. Sem precisar reverter git.

### 5.5 Deploy de mudança no portal (resumido)

1. Branch `develop` local → mudança → `npm run dev` testa
2. `git push origin develop`
3. PR `develop → main` (ou merge fast-forward)
4. Amplify auto-deploya `main` → ~5-8 min
5. Valida URL produção

### 5.6 Conferir se Parquet tá em dia

Query rápida (deve retornar a data de hoje ou ontem):
```sql
SELECT MAX(dt) FROM customizador_events.eventos_parquet;
```

Se atrasado, ver troubleshooting "Parquet desatualizado".

---

## 6. Troubleshooting

### 6.1 "Could not load credentials from any providers"

**Onde aparece**: response de qualquer rota `/api/analytics/*` retorna 500.

**Causa**: AWS SDK não conseguiu resolver credentials no Amplify SSR Lambda. Pode ser:
- IAM Role não anexada como **Compute Role** (separada da Service Role)
- Amplify Credential Listener desabilitado

**Como diagnosticar**:
Cria temporariamente um endpoint `/api/debug/aws/route.ts` com:
```ts
export async function GET() {
  return Response.json({
    container_creds: !!process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI,
    listener_enabled: process.env.AWS_AMPLIFY_CREDENTIAL_LISTENER_ENABLED,
  });
}
```

Se `listener_enabled = "false"` → falta configurar Compute Role.

**Solução**:
```bash
# No AWS CloudShell (>_ no topo do console)
aws amplify update-app \
  --app-id d20t94dp8646px \
  --compute-role-arn arn:aws:iam::891377125620:role/amplify-archtechtour-portal-ssr \
  --region sa-east-1
```

Depois disso, fazer **redeploy manual** no Amplify (Console → app → branch main → "Redeploy this version") pra a Lambda pegar a nova role.

### 6.2 504 Gateway Timeout em /refresh

**Causa**: Amplify SSR Gen 1 tem timeout fixo de 30s. Se as queries Athena demoram (Parquet desatualizado ou query muito grande), bate no limite.

**Diagnóstico rápido**:
```sql
SELECT COUNT(*) FROM customizador_events.eventos_parquet;
SELECT MAX(dt) FROM customizador_events.eventos_parquet;
```

Se `MAX(dt)` está muito atrasado → o Parquet não foi atualizado pela Lambda. Solução: rodar manualmente a Lambda `parquet-monthly-etl` (passos em §7.2).

Se Parquet tá em dia → query específica é o gargalo. Olhar CloudWatch Logs do SSR Lambda pra identificar qual query.

### 6.3 "S3 location not in same region" no Athena

**Causa**: AthenaClient sendo criado em região errada. Provavelmente env var `AWS_REGION` (sa-east-1) está sobrescrevendo a config.

**Verificar**: `src/lib/aws-clients.ts` deve usar `APP_AWS_REGION` (não `AWS_REGION`) e resolver em runtime:
```ts
function getRegion() {
  return process.env.APP_AWS_REGION || "us-east-1";
}
```

`APP_AWS_REGION` é setada como env var no Amplify Console (App settings → Environment variables).

### 6.4 Build do Amplify falhou com "Environment variables cannot start with reserved prefix AWS"

**Causa**: alguém setou env var começando com `AWS_*` nas configs do Amplify.

**Solução**: renomear a variável. Padrão do projeto: usar prefixo `APP_AWS_*` (ex: `APP_AWS_REGION`). O código TypeScript já tem fallback em `aws-clients.ts`.

### 6.5 Dashboard de um cliente sumiu / mostra estado vazio

**Diagnóstico**:
1. Cliente está no `dim_client_alias`?
   ```sql
   SELECT * FROM customizador_events.dim_client_alias WHERE alias = 'X';
   ```
2. JSON existe no S3?
   ```bash
   aws s3 ls s3://archtechtour-assets/analytics-cache/X/
   ```

**Soluções**:
- Se alias não existe no dim → adicionar via UI ou SQL (§5.1)
- Se JSON não existe → forçar refresh (§5.2)
- Se ambos existem mas dashboard vazio → fazer hard refresh do navegador (Cmd+Shift+R) — pode ser cache stale

### 6.6 Auto-deploy não rodou após push

**Verificar**:
1. Push chegou no `origin/main`?
   ```bash
   git log origin/main -3
   ```
2. Amplify console → app → veja "Last update". Se >10min atrás do push, algo travou.

**Soluções**:
- Forçar manual: Amplify Console → app → branch main → "Redeploy this version"
- Verificar webhook GitHub: GitHub repo → Settings → Webhooks (deve ter um do Amplify)
- Se webhook foi removido: reconectar via Amplify Console → app → General settings → Reconnect repository

### 6.7 Lambda mensal não rodou

**Diagnóstico**:
- CloudWatch → Logs groups → procurar logs do dia 5/10
- Se não tem log → EventBridge rule não disparou
- Se tem log mas falhou → erro específico

**Soluções**:
- EventBridge Console → Rules → verificar se rule está **Enabled** e schedule correto
- Rodar Lambda manual: Lambda Console → função → aba Test → payload `{}` → Test
- Pra `parquet-monthly-etl`: se quer reprocessar mês específico, setar env var `TARGET_MONTH=2026-04` temporariamente

### 6.8 Athena retorna "permission denied" no Parquet

**Causa**: IAM Role sem permissão de S3 no `archtechtour-assets`.

**Verificar**: policy `archtechtour-portal-athena-s3` anexada na role `amplify-archtechtour-portal-ssr` deve ter:
```json
{
  "Resource": [
    "arn:aws:s3:::archtechtour-assets",
    "arn:aws:s3:::archtechtour-assets/*"
  ],
  "Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket"]
}
```

---

## 7. Procedimentos críticos

### 7.1 Rotacionar AWS access key vazada

```bash
# Console AWS → IAM → Users → powerbi-athena-user
# Aba: Security credentials
# 1. Encontra a key comprometida → "Make inactive" (não delete ainda)
# 2. "Create access key" → guarda Access Key ID + Secret em local seguro
# 3. No Mac:
aws configure   # cola as novas keys
aws sts get-caller-identity   # confirma identidade

# 4. Atualiza .env.local do portal (se você usa local também):
# Substitui AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY

# 5. Volta no IAM Console → Delete a key antiga
```

⚠️ **Não delete a key antiga antes de testar a nova** — você fica sem acesso.

### 7.2 Reprocessar um mês de Parquet manualmente

Se o cron dia 5 falhou ou quer reprocessar histórico:

**Via Lambda** (depois de deployada):
1. Lambda Console → `parquet-monthly-etl` → Configuration → Environment variables
2. Adiciona: `TARGET_MONTH = 2026-04` (mês alvo)
3. Aba Test → payload `{}` → Test
4. Aguarda CloudWatch logs confirmarem "ETL concluído"
5. **Remove a env var TARGET_MONTH** (senão próximo cron vai re-rodar abril)

**Via Athena diretamente** (se Lambda não deployada ainda):
```sql
-- Drop partições do mês alvo (idempotência)
ALTER TABLE customizador_events.eventos_parquet
  DROP IF EXISTS PARTITION (dt='2026-04-01'), PARTITION (dt='2026-04-02'), ...;

-- Reinsere
INSERT INTO customizador_events.eventos_parquet
SELECT evento, produto, categoria, rotulo, user_id, session_id, user_agent, referrer,
       "timestamp" AS ts, pais, estado, cidade, latitude, longitude, timezone, origem_trafego,
       date_format(from_unixtime("timestamp"), '%Y-%m-%d') AS dt
FROM customizador_events.eventos_customizador
WHERE from_unixtime("timestamp") >= TIMESTAMP '2026-04-01 00:00:00'
  AND from_unixtime("timestamp") <  TIMESTAMP '2026-05-01 00:00:00';
```

### 7.3 Restaurar dashboard de um cliente após problema

Cenário: JSON do cliente foi sobrescrito errado ou perdido.

1. **Backup nos snapshots S3** (se tiver versioning habilitado):
   ```bash
   aws s3api list-object-versions \
     --bucket archtechtour-assets \
     --prefix analytics-cache/rsdesign/
   # Restaurar versão anterior
   aws s3api copy-object \
     --bucket archtechtour-assets \
     --copy-source archtechtour-assets/analytics-cache/rsdesign/latest.json?versionId=<VERSION> \
     --key analytics-cache/rsdesign/latest.json
   ```

2. **Regerar do Athena**: forçar refresh (§5.2). Dados originais estão em `eventos_parquet`.

### 7.4 Rollback de deploy do portal

Amplify Console → app → branch `main` → na lista de builds, clica nos `...` da versão anterior → "Redeploy this version".

Ou via git:
```bash
git revert <COMMIT_HASH>
git push origin main
```

### 7.5 Adicionar permissão à IAM Role

Console → IAM → Roles → `amplify-archtechtour-portal-ssr` → Permissions → Add permissions → Create inline policy → JSON → cola o policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["<service>:<action>"],
    "Resource": "<arn>"
  }]
}
```

Após salvar, redeploy do Amplify pra propagar (às vezes não precisa, mas garante).

### 7.6 Disaster recovery — recriar tudo do zero

Se a infraestrutura inteira for perdida:

1. **Código**: já está no GitHub
2. **Dados eventos crus**: estão em `s3://explorar.archtechtour.com/eventos/` (versionamento habilitado?)
3. **Tabelas Athena**:
   - `dim_client_alias`: poucos registros — recriar via SQL
   - `eventos_parquet`: recriar com `CREATE EXTERNAL TABLE` + INSERT mensal por loop (script `/tmp/migrate_parquet.sh` na raiz do home do dev)
4. **IAM Role**: trust policy + policy JSON estão documentados em §2 e §3
5. **Amplify**: criar app novo via console, apontar pro GitHub repo
6. **Lambdas**: zips e código em `lambda/*/` no repo

Tempo estimado de DR completo: 4-6 horas.

---

## 8. Referência rápida

### URLs importantes

| Recurso | URL |
|---|---|
| Portal produção | https://main.d20t94dp8646px.amplifyapp.com |
| GitHub repo | https://github.com/arxpalhano/att |
| AWS Console | https://console.aws.amazon.com/ (conta 891377125620) |
| Amplify Console | https://console.aws.amazon.com/amplify/home?region=sa-east-1 |
| Athena Console | https://console.aws.amazon.com/athena/home?region=us-east-1 |
| Lambda Console | https://console.aws.amazon.com/lambda/home?region=us-east-1 |
| S3 archtechtour-assets | https://s3.console.aws.amazon.com/s3/buckets/archtechtour-assets |

### IDs e ARNs

| Recurso | Valor |
|---|---|
| AWS Account ID | 891377125620 |
| Amplify App ID | d20t94dp8646px |
| IAM Role SSR/Compute | `arn:aws:iam::891377125620:role/amplify-archtechtour-portal-ssr` |
| API Gateway eventos (legado) | `https://odwlqrkix5.execute-api.us-east-1.amazonaws.com/register-event` |

### Comandos AWS CLI úteis

```bash
# Identificar quem você é
aws sts get-caller-identity

# Listar dashboards no S3
aws s3 ls s3://archtechtour-assets/analytics-cache/

# Ver quantos eventos hoje
aws s3 ls s3://explorar.archtechtour.com/eventos/ --recursive | grep "$(date +%Y-%m-%d)" | wc -l

# Rodar query Athena ad-hoc
QID=$(aws athena start-query-execution \
  --query-string "SELECT MAX(dt) FROM customizador_events.eventos_parquet" \
  --query-execution-context Database=customizador_events \
  --result-configuration OutputLocation=s3://explorar.archtechtour.com/athena-tmp/ \
  --region us-east-1 --query QueryExecutionId --output text)

# Aguardar e pegar resultado
sleep 5
aws athena get-query-results --query-execution-id $QID --region us-east-1

# Ver logs Amplify SSR
aws logs tail /aws/amplify/d20t94dp8646px/main --region sa-east-1 --since 1h --follow

# Invoke Lambda manual
aws lambda invoke --function-name parquet-monthly-etl --payload '{}' /tmp/out.json --region us-east-1
cat /tmp/out.json
```

### Variáveis de ambiente

**No Amplify** (App settings → Environment variables):
| Key | Value | Onde é usada |
|---|---|---|
| `ATHENA_DB` | `customizador_events` | rotas /api/analytics/* |
| `ATHENA_WORKGROUP` | `primary` | rotas /api/analytics/* |
| `ATHENA_OUTPUT` | `s3://explorar.archtechtour.com/athena-tmp/` | rotas /api/analytics/* |
| `ANALYTICS_S3_BUCKET` | `archtechtour-assets` | leitura/escrita dos JSONs de dashboard |
| `APP_AWS_REGION` | `us-east-1` | clients AWS (Athena/S3) |
| `_LIVE_UPDATES` | `[{"name":"Next.js version","pkg":"next-version","type":"internal","version":"latest"}]` | Amplify internal |

**Localmente** (`.env.local`):
| Key | Value |
|---|---|
| `NODE_ENV` | `development` |
| `AWS_REGION` | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | (suas keys) |
| `AWS_SECRET_ACCESS_KEY` | (sua secret) |
| `ATHENA_DB` | `customizador_events` |
| `ATHENA_WORKGROUP` | `primary` |
| `ATHENA_OUTPUT` | `s3://explorar.archtechtour.com/athena-tmp/` |

### Status de saúde — check rápido

Cole no terminal pra ver tudo em 30s:

```bash
echo "=== Portal up?" && curl -sS -o /dev/null -w "%{http_code}\n" https://main.d20t94dp8646px.amplifyapp.com/
echo "=== /api/analytics/clients?" && curl -sS https://main.d20t94dp8646px.amplifyapp.com/api/analytics/clients | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'  {len(d.get(\"clients\",[]))} clientes')"
echo "=== Parquet atualizado?"
QID=$(aws athena start-query-execution --query-string "SELECT MAX(dt) FROM customizador_events.eventos_parquet" --query-execution-context Database=customizador_events --result-configuration OutputLocation=s3://explorar.archtechtour.com/athena-tmp/ --region us-east-1 --query QueryExecutionId --output text)
sleep 4
aws athena get-query-results --query-execution-id $QID --region us-east-1 --query 'ResultSet.Rows[1].Data[0].VarCharValue' --output text
```

Resultado esperado:
- Portal: `200`
- 7 clientes
- MAX(dt) deve ser ontem ou hoje (se Lambda do customizador escrevendo + cron rodando)

---

## Glossário

- **Alias**: prefixo dos produtos no customizador (ex: `rsdesign`), usado como chave no dim e nas URLs do portal.
- **Block / Bloco 3D**: produto digitalizado da ArchTechTour — uma cadeira, mesa, etc., modelada em 3D e publicada no customizador Verge3D.
- **dim_client_alias**: tabela "dimensão" no Athena que liga alias → nome legível do cliente.
- **dt**: coluna de partição no `eventos_parquet`, formato YYYY-MM-DD.
- **Customizador**: aplicação Verge3D que permite ao usuário final visualizar/customizar produtos 3D no browser.
- **Compute Role**: IAM Role usada pelo Amplify SSR runtime (diferente da Service Role de build).
- **CRON Athena**: as Lambdas mensais que mantêm o pipeline rodando sem intervenção.
- **eventos_parquet**: tabela Parquet particionada — fonte de verdade dos analytics.

---

## Contatos & escalação

| Tipo de problema | Quem chamar |
|---|---|
| Bug funcional do portal | Matheus Palhano (Tech Lead) |
| AWS / infra | Matheus Palhano |
| Pipeline analytics quebrado | Matheus Palhano (ou seguir este manual) |
| Dúvidas de negócio (que dados mostrar?) | Mariana Pesca (CEO) |
| Cliente reclamando do dashboard | Jéssica Ribeiro (Ops) → triagem → Tech |

---

*Documento mantido por Matheus Palhano. Atualizar sempre que algo crítico mudar.*
