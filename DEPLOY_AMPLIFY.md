# Deploy do Portal ATT no AWS Amplify

> Tempo estimado: **30 minutos** de cliques no Console AWS.
> Custo estimado: **~$3-8/mês** (hosting + SSR compute + data served).

---

## Checklist em ordem

- [ ] **Passo 0** — Rotacionar a AWS key vazada (`AKIA47CRXRD2MWFO4FKS`)
- [ ] **Passo 1** — Criar IAM Role pro Amplify SSR
- [ ] **Passo 2** — Conectar GitHub no Amplify e criar o app
- [ ] **Passo 3** — Configurar variáveis de ambiente no Amplify
- [ ] **Passo 4** — Trigger do primeiro deploy
- [ ] **Passo 5** — Apontar domínio (`app.archtechtour.com` ou similar)
- [ ] **Passo 6** — Deploy da Lambda mensal `analytics-compute`
- [ ] **Passo 7** — Criar EventBridge rule (dia 10)

---

## Passo 0 — Rotacionar a AWS key vazada

A key `AKIA47CRXRD2MWFO4FKS` está em logs/histórico. **Antes** de qualquer outra coisa:

1. AWS Console → **IAM** → Users → `powerbi-athena-user` → **Security credentials**
2. Na seção "Access keys", encontre a key `AKIA47CRXRD2MWFO4FKS`
3. **Make inactive** → confirm
4. **Create access key** → escolha "Application running outside AWS" → Next → Create
5. **Anote** as novas credenciais (só aparecem 1 vez)
6. No seu Mac:
   ```bash
   aws configure
   # cola as novas keys
   ```
7. Apague a key antiga: clica nela → **Delete**

Pronto. Sua dev local continua funcionando, e a key antiga não vale mais nada.

---

## Passo 1 — IAM Role para o Amplify SSR

O Amplify roda suas API routes em **AWS Lambda gerenciado**. Pra essa Lambda acessar Athena/S3, precisa de uma IAM Role.

### 1.1 Criar a Role

1. AWS Console → **IAM** → **Roles** → **Create role**
2. **Trusted entity type**: AWS service
3. **Service**: Lambda
4. Next
5. **Skip policy attachment for now** (vamos criar inline)
6. **Role name**: `amplify-archtechtour-portal-ssr`
7. Create role

### 1.2 Anexar a policy inline

Abra a role criada → aba **Permissions** → **Add permissions** → **Create inline policy** → tab **JSON** → cola:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AthenaQueries",
      "Effect": "Allow",
      "Action": [
        "athena:StartQueryExecution",
        "athena:GetQueryExecution",
        "athena:GetQueryResults",
        "athena:GetWorkGroup",
        "athena:GetTableMetadata",
        "athena:ListDatabases",
        "athena:ListTableMetadata"
      ],
      "Resource": "*"
    },
    {
      "Sid": "GlueCatalog",
      "Effect": "Allow",
      "Action": [
        "glue:GetDatabase",
        "glue:GetDatabases",
        "glue:GetTable",
        "glue:GetTables",
        "glue:GetPartitions"
      ],
      "Resource": "*"
    },
    {
      "Sid": "S3AnalyticsCache",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::archtechtour-assets",
        "arn:aws:s3:::archtechtour-assets/*"
      ]
    },
    {
      "Sid": "S3AthenaIO",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ],
      "Resource": [
        "arn:aws:s3:::explorar.archtechtour.com",
        "arn:aws:s3:::explorar.archtechtour.com/*"
      ]
    }
  ]
}
```

Next → **Policy name**: `archtechtour-portal-athena-s3` → Create

### 1.3 Permitir Amplify usar essa role (trust policy)

Aba **Trust relationships** da role → **Edit trust policy** → cola:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": ["lambda.amazonaws.com", "amplify.amazonaws.com"]
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

Save changes.

**Copie o ARN da role** (aparece no topo da página, formato `arn:aws:iam::891377125620:role/amplify-archtechtour-portal-ssr`). Vai precisar no passo 2.

---

## Passo 2 — Criar o app no Amplify

1. AWS Console → busca **Amplify** → **AWS Amplify**
2. **Create new app** → **Host web app**
3. **GitHub** → Continue → autoriza Amplify a ver seus repos
4. **Repository**: `arxpalhano/att` → **Branch**: `main`
5. **App name**: `archtechtour-portal`
6. **Build settings**:
   - Detect Next.js 14 automaticamente
   - **Build commands**: já está populado (tem o `amplify.yml` no repo)
   - **Environment**: SSR (server-side rendering) ← **importante**
7. **Service role**: cola o ARN da role criada no passo 1
8. Next → Review → **Save and deploy**

Vai começar a buildar. Demora ~5 min na primeira vez.

---

## Passo 3 — Variáveis de ambiente

Antes do build terminar, abre **App settings** → **Environment variables**:

| Key | Value |
|---|---|
| `ATHENA_DB` | `customizador_events` |
| `ATHENA_WORKGROUP` | `primary` |
| `ATHENA_OUTPUT` | `s3://explorar.archtechtour.com/athena-tmp/` |
| `ANALYTICS_S3_BUCKET` | `archtechtour-assets` |
| `AWS_REGION` | `us-east-1` |
| `NODE_ENV` | `production` |

**NÃO** configure `AWS_ACCESS_KEY_ID` nem `AWS_SECRET_ACCESS_KEY` — o SDK usa a IAM Role automaticamente.

**NÃO** configure `ANALYTICS_REFRESH_SECRET` ainda (vamos deixar a UI funcionando primeiro).

Se você usa `ANTHROPIC_API_KEY` no `/api/analyze` (análise Claude de assets), cole aqui também.

Save → triggera novo deploy.

---

## Passo 4 — Validar o deploy

Quando o deploy estiver verde:

```bash
# Substitua pela URL do Amplify (algo tipo https://main.dxxxxxxxxx.amplifyapp.com)
curl https://main.XXXX.amplifyapp.com/api/analytics/rsdesign | head -c 200
```

Deve retornar o JSON da RS Design.

Abra a URL no browser → login → Analytics → vê o dashboard.

---

## Passo 5 — Domínio customizado

1. Amplify → seu app → **Hosting** → **Custom domains** → **Add domain**
2. Escolha o domínio que vai usar — sugestão: `app.archtechtour.com` ou `portal.archtechtour.com`
3. Se `archtechtour.com` está em outro registrador (não Route 53), o Amplify mostra os CNAMEs pra você adicionar no DNS
4. Se está em Route 53 → ele configura sozinho
5. Esperar SSL provisionar (~10-30 min)

---

## Passo 6 — Lambda mensal `analytics-compute`

### 6.1 Build da Lambda

No seu Mac:

```bash
cd /Users/palhano/att/lambda/analytics-compute
npm install
# Empacotar (sem typescript build — Lambda Node 20 roda .mjs/.cjs nativo)
# Convertemos TS pra JS:
npx tsc index.ts --target es2022 --module commonjs --esModuleInterop
zip -r function.zip index.js node_modules
```

### 6.2 Criar a função

1. AWS Console → **Lambda** → **Create function** → **Author from scratch**
2. **Name**: `analytics-compute`
3. **Runtime**: Node.js 20.x
4. **Architecture**: arm64
5. **Permissions** → **Use an existing role** → cole `amplify-archtechtour-portal-ssr` (a mesma do passo 1)
6. Create function
7. **Code** tab → **Upload from** → **.zip file** → seleciona o `function.zip`
8. **Configuration** → **General configuration** → Edit:
   - **Timeout**: 15 min
   - **Memory**: 512 MB
9. **Configuration** → **Environment variables**:
   - `ANALYTICS_API_URL` = URL do Amplify (do passo 4)
   - `ATHENA_DB` = `customizador_events`
   - `ATHENA_OUTPUT` = `s3://explorar.archtechtour.com/athena-tmp/`

### 6.3 Test invoke manual

Aba **Test** → cria evento "test" com payload `{}` → **Test**

Deve retornar `statusCode: 200` com lista de clientes processados.

---

## Passo 7 — EventBridge mensal (dia 10)

1. AWS Console → **EventBridge** → **Rules** → **Create rule**
2. **Name**: `analytics-monthly-refresh`
3. **Rule type**: Schedule
4. Continue → **Recurring schedule** → **Cron expression**: `0 3 10 * ? *` (dia 10 às 03h UTC = 00h Brasília)
5. Next → **Target**: AWS Lambda → função `analytics-compute`
6. Next → Next → Create rule

Pronto. **Todo dia 10 a Lambda dispara**, busca os clientes da dim, e chama a API do Amplify pra cada um refazer o dashboard.

---

## Smoke test final

1. `https://app.archtechtour.com` (ou URL Amplify) → login → Analytics → vê dashboard RS Design
2. Admin → Analytics → Gerenciar clientes → vê 7 clientes da dim
3. Clica "Atualizar" em Jader Almeida → ~12s depois aparece o dashboard dele
4. EventBridge → Rules → `analytics-monthly-refresh` → status "Enabled"
5. Lambda → `analytics-compute` → "Invoke" manual → resposta 200

---

## Custo esperado mensal

| Serviço | Estimativa |
|---|---|
| Amplify Hosting (build + storage + data) | $1-3 |
| Amplify SSR compute (~1000 reqs/mês × 100-500ms) | $0,50-2 |
| Athena queries (~10 refresh/mês × 8 queries) | $0,10-0,30 |
| S3 storage analytics-cache (<1 MB) | $0,001 |
| Lambda mensal (1 invoke × 5 min) | $0,005 |
| **Total** | **~$3-8/mês** |

---

## Troubleshooting

**Build falha com erro de peer deps?** O `amplify.yml` usa `npm ci --legacy-peer-deps`. Se ainda falhar, ver Build logs no Amplify.

**API `/refresh` retorna AccessDenied no Athena?** A IAM Role não foi anexada corretamente. Verifica em Lambda console (Amplify SSR aparece como uma Lambda interna) qual role tá usando.

**API `/refresh` timeout?** Amplify SSR default é 30s. Vai em **App settings** → **Edge functions** ou **Compute** e aumenta pra 60s. Algumas queries Athena podem demorar 15-20s.

**Lambda mensal sem rede pra chamar API?** Lambda padrão tem internet. Se você colocou ela em VPC sem NAT, perdeu net. Tirar da VPC ou adicionar NAT Gateway.
