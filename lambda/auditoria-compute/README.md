# Lambda auditoria-compute

Roda o checklist de validação em **todos** os customizadores publicados em `s3://explorar.archtechtour.com` e salva o resultado em `s3://explorar.archtechtour.com/_auditoria/`.

## Estrutura

- `handler.py` — entry point, listagem de produtos, paralelismo (ThreadPool 32), agregação
- `validar_produto.py` — 12 checks por produto (port do `att-agents/plugins/att-validador/scripts/validar_produto.py`, sem dependência de aws CLI/curl)
- `deploy.sh` — empacota e atualiza o Lambda

## Modos de execução

### 1. Auditoria completa (cron semanal)
EventBridge: `cron(0 3 ? * SUN *)` — todo domingo 03h UTC.

Lista todos os `index.html` no bucket, valida em paralelo (~60s pra ~400 produtos), salva:
- `s3://explorar.archtechtour.com/_auditoria/latest.json` (agregado)
- `s3://explorar.archtechtour.com/_auditoria/historico/{YYYY-MM-DD}.json` (snapshot)
- `s3://explorar.archtechtour.com/_auditoria/detalhes/{cliente}__{produto}.json` (1 por produto, com os 12 checks)

### 2. Refresh pontual (invoke direto)
Event: `{"prefix": "rs/ver-9/arquibancada-aris/"}`
Valida só esse produto, atualiza `detalhes/` e faz merge em `latest.json`.

## Rodar localmente

Requer `AWS_PROFILE=att-admin` exportado (ou config equivalente).

```bash
# Auditoria completa (cuidado: vai consultar S3 e fazer ~1200 HEAD HTTP)
AWS_PROFILE=att-admin python3 handler.py

# Refresh de um produto
AWS_PROFILE=att-admin python3 handler.py rs/ver-9/arquibancada-aris/
```

## Deploy

Já tem que ter o Lambda criado no console (uma vez). Depois:
```bash
bash deploy.sh
```

## Permissões IAM mínimas

```json
{
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": "arn:aws:s3:::explorar.archtechtour.com" },
    { "Effect": "Allow", "Action": ["s3:GetObject"], "Resource": "arn:aws:s3:::explorar.archtechtour.com/*" },
    { "Effect": "Allow", "Action": ["s3:PutObject"], "Resource": "arn:aws:s3:::explorar.archtechtour.com/_auditoria/*" },
    { "Effect": "Allow", "Action": ["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents"], "Resource": "*" }
  ]
}
```

## Env vars

- `AUDITORIA_BUCKET` (default: `explorar.archtechtour.com`)
- `AUDITORIA_PREFIX` (default: `_auditoria`)
- `MAX_WORKERS` (default: `32`)
