# Lambda: analytics-compute

Roda todo **dia 10 às 03h UTC** via EventBridge.
Chama o endpoint `/api/analytics/[alias]/refresh` do Amplify pra cada cliente da `dim_client_alias`.
O endpoint do Amplify lê do **eventos_parquet** (rápido) e salva o JSON por cliente no S3.

---

## Pipeline mensal completo

```
Dia 1-31  →  Lambda do customizador escreve JSONs em eventos/
Dia 5 03h →  Lambda parquet-monthly-etl: INSERT do mês anterior em eventos_parquet
Dia 10 03h → ESTA Lambda: chama /api/analytics/[alias]/refresh pra cada cliente
             (Amplify lê do Parquet rápido, salva JSON por cliente no S3)
```

---

## Deploy (primeira vez)

```bash
cd lambda/analytics-compute
npm install
npm run build           # compila TypeScript → dist/
npm run deploy          # cria zip e sobe Lambda
```

> A Lambda precisa de `ANALYTICS_API_URL` configurado no console AWS.

---

## Variáveis de ambiente da Lambda (AWS Console)

| Variável | Valor |
|---|---|
| `ANALYTICS_API_URL` | `https://main.d20t94dp8646px.amplifyapp.com` (ou domínio customizado) |
| `ATHENA_DB` | `customizador_events` |
| `ATHENA_OUTPUT` | `s3://explorar.archtechtour.com/athena-tmp/` |
| `ANALYTICS_REFRESH_SECRET` | (opcional) — se setado, Lambda envia no header `x-analytics-secret` |

---

## IAM Role

Mesma role do Amplify SSR (`amplify-archtechtour-portal-ssr`) — já tem athena + s3.

---

## EventBridge (agendamento dia 10)

Console AWS → EventBridge → Rules → Create rule:

- **Schedule**: `cron(0 3 10 * ? *)` → todo dia 10 às 03h UTC
- **Target**: Lambda `analytics-compute`

---

## Como funciona

A Lambda é "burra" — não faz queries Athena diretamente. Em vez disso:

1. Lista clientes do `dim_client_alias` (1 query Athena rápida)
2. Pra cada cliente, chama `POST {ANALYTICS_API_URL}/api/analytics/{alias}/refresh`
3. O endpoint Amplify roda as queries Athena no Parquet (rápido) e salva no S3
4. Loga sucesso/erro pra cada cliente

Vantagem: lógica de analytics num lugar só (`src/lib/analytics-builder.ts` no portal).

---

## Test invoke manual

Console AWS → Lambda → `analytics-compute` → aba **Test** → payload `{}` → **Test**.

Ou via CLI:
```bash
aws lambda invoke --function-name analytics-compute --payload '{}' output.json
cat output.json
```
