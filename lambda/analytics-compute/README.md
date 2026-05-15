# Lambda: analytics-compute

Roda todo **dia 10** às 03h00 UTC via EventBridge.  
Consulta o Athena e salva um JSON por cliente no S3 → o portal lê e exibe o dashboard.

---

## Deploy (primeira vez)

```bash
cd lambda/analytics-compute
npm install
npm run build           # compila TypeScript → dist/
npm run deploy          # cria o zip e sobe para a Lambda
```

> A Lambda precisa ter a variável de ambiente `ANALYTICS_BUCKET` configurada no console AWS.

---

## Variáveis de ambiente da Lambda (AWS Console)

| Variável | Valor |
|---|---|
| `ANALYTICS_BUCKET` | `archtechtour-assets` (ou o bucket que preferir) |
| `ATHENA_DB` | `customizador_events` |
| `ATHENA_WORKGROUP` | `primary` |
| `ATHENA_OUTPUT` | `s3://archtechtour-assets/athena-tmp/` |

---

## IAM Role da Lambda

A Lambda precisa de permissões para:
- `s3:GetObject` + `s3:PutObject` no `ANALYTICS_BUCKET`
- `athena:StartQueryExecution`, `athena:GetQueryExecution`, `athena:GetQueryResults`
- `s3:GetObject` + `s3:PutObject` no bucket do Athena output (`ATHENA_OUTPUT`)
- `s3:GetObject` no bucket de eventos (`explorar.archtechtour.com`) para o Athena ler

O `powerbi-athena-user` já tem essas permissões — pode criar uma IAM Role com a mesma policy.

---

## EventBridge (agendamento dia 10)

No console AWS → EventBridge → Rules → Create rule:

- **Schedule**: `cron(0 3 10 * ? *)` → todo dia 10 às 03h UTC (meia-noite BRT)
- **Target**: Lambda `analytics-compute`

---

## Rodar manualmente para RS Design (agora)

Para popular o dashboard da RS Design com dados reais antes do dia 10, invoke a Lambda manualmente:

```bash
aws lambda invoke \
  --function-name analytics-compute \
  --payload '{}' \
  output.json

cat output.json
```

Ou no console AWS → Lambda → Test → evento vazio `{}`.

---

## Como o portal lê os dados

`GET /api/analytics/rsdesign`

1. Tenta `s3://ANALYTICS_BUCKET/analytics-cache/rsdesign/latest.json`
2. Fallback: `public/analytics-data/rsdesign.json` (arquivo de exemplo local)

O alias (`rsdesign`) vem do código do cliente em letras minúsculas (`RSDESIGN.toLowerCase()`).

---

## Adicionar novo cliente

1. Inserir na `dim_client_alias` do Athena:
   ```sql
   INSERT INTO customizador_events.dim_client_alias (alias, cliente)
   VALUES ('novoalias', 'Nome do Cliente');
   ```
2. Invocar a Lambda (ela vai criar o JSON automaticamente).
3. Adicionar o cliente no Portal (`CLIENTS` em `Portal.tsx` e o usuário com `role: "client"`).
