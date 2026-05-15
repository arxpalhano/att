# Lambda: parquet-monthly-etl

Migra eventos do mês anterior de JSON (em `eventos/`) pra Parquet particionado (`eventos_parquet`).
Roda automaticamente **dia 5 às 03h UTC** via EventBridge.

---

## Pipeline mensal completo

```
Dia 1-31  →  Lambda do customizador escreve JSONs em eventos/
Dia 5 03h →  ESTA Lambda: INSERT do mês anterior em eventos_parquet
Dia 10 03h → Lambda analytics-compute: chama /api/analytics/[alias]/refresh
             (lê do Parquet rápido, salva JSON por cliente no S3)
```

5 dias de buffer entre dia 5 e dia 10 — se a migração falhar, há tempo de corrigir antes dos dashboards atualizarem.

---

## Deploy (primeira vez)

No seu Mac:

```bash
cd lambda/parquet-monthly-etl
npm install
npm run package    # gera function.zip

# Criar Lambda no AWS Console:
# - Name: parquet-monthly-etl
# - Runtime: Node.js 20.x
# - Architecture: arm64
# - Execution role: amplify-archtechtour-portal-ssr (a mesma das outras Lambdas)
# - Timeout: 15 min
# - Memory: 256 MB

# Upload do zip pelo console OU:
aws lambda create-function \
  --function-name parquet-monthly-etl \
  --runtime nodejs20.x \
  --role arn:aws:iam::891377125620:role/amplify-archtechtour-portal-ssr \
  --handler index.handler \
  --architectures arm64 \
  --timeout 900 \
  --memory-size 256 \
  --zip-file fileb://function.zip \
  --region us-east-1 \
  --environment Variables='{ATHENA_DB=customizador_events,ATHENA_OUTPUT=s3://explorar.archtechtour.com/athena-tmp/}'
```

Updates depois:

```bash
npm run deploy
```

---

## EventBridge (agendamento dia 5)

Console AWS → **EventBridge** → **Rules** → **Create rule**:

- **Name**: `parquet-monthly-etl-trigger`
- **Region**: us-east-1
- **Schedule**: `cron(0 3 5 * ? *)` → todo dia 5 às 03h UTC
- **Target**: Lambda `parquet-monthly-etl`

---

## Rodar manualmente (reprocessar um mês específico)

Console AWS → Lambda → `parquet-monthly-etl` → aba **Test**:

```json
{}
```

Pra mês específico (override), em **Configuration → Environment variables**, adicionar temporariamente:
```
TARGET_MONTH = 2026-03
```

Roda, depois remove a env var.

> ⚠️ A Lambda **drop-AND-recreate** as partições do mês alvo — idempotente, pode rodar quantas vezes quiser pro mesmo mês.

---

## Como saber se rodou OK

CloudWatch Logs → `/aws/lambda/parquet-monthly-etl` → último stream.

Saída esperada:
```
Parquet ETL — mês alvo: 2026-04
Range: 2026-04-01 (inclusivo) → 2026-05-01 (exclusivo)
[drop-partitions] ✓ done in 1500ms
[insert-month] ✓ done in 45000ms, scanned 172000000 bytes
ETL concluído com sucesso pra 2026-04
```

---

## Custo estimado

- 1 execução/mês × ~1 min × 256 MB = $0.0001/mês
- Athena scan: ~$0.005/mês (172MB × $5/TB)
- **Total: ~$0.01/mês**
