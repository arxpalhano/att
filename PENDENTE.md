# Checklist de pendências — ArchTechTour Portal

Última atualização: 2026-05-15

---

## Status geral

✅ **Produção rodando** em `https://main.d20t94dp8646px.amplifyapp.com`
✅ **3 clientes com dashboard real** (RS Design, Cadeiras Rosa, Pedro Franco)
✅ **Refresh manual funciona** (6-9s, depois da migração Parquet)
✅ **Tabela `eventos_parquet`** populada com 328k eventos históricos (jul/2025 → mai/2026)

---

## 🔴 Alta prioridade

### [ ] 1. Rotacionar AWS access key vazada
**Key comprometida**: `AKIA47CRXRD2MWFO4FKS` (do user `powerbi-athena-user`)
**Por quê**: foi colada em chat e está no histórico de conversa.
**Como**:
1. AWS Console → IAM → Users → `powerbi-athena-user` → Security credentials
2. Encontra a key `AKIA47CRXRD2MWFO4FKS` → **Make inactive**
3. **Create access key** → guardar as novas
4. No Mac: `aws configure` → cola as novas
5. Delete a antiga

### [ ] 2. Deploy Lambda `parquet-monthly-etl` (CRON dia 5)
**O que faz**: migra eventos do mês anterior de JSON → Parquet particionado.
**Por quê**: sem isso, a partir de junho/2026 os dashboards não terão eventos novos.
**Arquivos prontos**: `lambda/parquet-monthly-etl/function.zip` (6.5KB)
**Passos**:
- [ ] Console AWS → Lambda → Create function
  - Name: `parquet-monthly-etl`
  - Runtime: Node.js 20.x, arm64
  - Role: `amplify-archtechtour-portal-ssr` (existing)
  - Handler: `index.handler`
  - Timeout: 15 min, Memory: 256 MB
  - Upload zip do path acima
- [ ] Env vars: `ATHENA_DB=customizador_events`, `ATHENA_OUTPUT=s3://explorar.archtechtour.com/athena-tmp/`
- [ ] Test invoke `{}` — deve migrar maio/2026
- [ ] EventBridge rule `parquet-monthly-etl-trigger` → `cron(0 3 5 * ? *)` → target Lambda
- Detalhes: `lambda/parquet-monthly-etl/README.md`

### [ ] 3. Deploy Lambda `analytics-compute` (CRON dia 10)
**O que faz**: chama `/api/analytics/[alias]/refresh` pra cada cliente do dim → atualiza dashboards.
**Por quê**: automação dos dashboards mensais sem ação humana.
**Passos**:
- [ ] Build local: `cd lambda/analytics-compute && npm install && npm run build`
- [ ] Empacotar: gerar `function.zip`
- [ ] Console AWS → Lambda → Create function (mesmo padrão acima)
  - Env var crítica: `ANALYTICS_API_URL=https://main.d20t94dp8646px.amplifyapp.com`
- [ ] EventBridge rule `analytics-monthly-refresh-trigger` → `cron(0 3 10 * ? *)`
- Detalhes: `lambda/analytics-compute/README.md`

---

## 🟡 Média prioridade

### [ ] 4. Domínio customizado para o portal
**Atual**: `https://main.d20t94dp8646px.amplifyapp.com` (URL feia do Amplify)
**Sugestão**: `https://app.archtechtour.com` ou `https://portal.archtechtour.com`
**Passos**:
1. Amplify Console → app → Hosting → **Custom domains** → Add domain
2. Se `archtechtour.com` está em Route 53 → Amplify configura sozinho
3. Senão: adicionar CNAME no DNS do registrador
4. **Atualizar `ANALYTICS_API_URL`** da Lambda `analytics-compute` pra o novo domínio depois que SSL provisionar

### [ ] 5. Validar fix do seletor admin (commit 50def89)
**O que mudou**: o seletor admin de cliente agora puxa do dim_client_alias (não da lista in-memory).
**Por quê testar**: bug anterior fazia seletor mostrar `pf` (Pedro Franco) mas dim tem `pedrofranco`.
**Como**:
- [ ] Aguardar auto-deploy do Amplify (~5 min após push)
- [ ] Logar como admin → Analytics → trocar entre todos os 7 clientes do seletor
- [ ] Cada um deve carregar dashboard (ou estado vazio + botão "Gerar")
- [ ] Clicar "Gerar" no Arctefacto → deve criar dashboard (a única sem dados ainda)

### [ ] 6. Mapear clientes do portal ↔ dim_client_alias
**Problema**: alguns clientes existem no portal (`CLIENTS[]`) mas não no dim, e vice-versa.

Atual:
- ✅ Bate: RS Design, Tidelli, Docol, Pedro Franco
- ❌ No portal, não no dim: Escal, Estúdio Bola, Wentz, Minimal, Hunter Douglas, DEXCO, WJ, Christie
- ❌ No dim, não no portal: Arctefacto, Cadeiras Rosa, Jader Almeida

**Decidir**:
- [ ] Adicionar os faltantes do portal no dim (rodar customizador deles primeiro?)
- [ ] Adicionar os faltantes do dim no portal (eles têm contrato?)
- [ ] OU consolidar: portal vira fonte de verdade + criar regras na Lambda customizador pra preencher dim automático

### [ ] 7. Remover JSONs antigos de `s3://explorar.archtechtour.com/eventos/`
**Quando**: depois de 1-2 meses validando que `eventos_parquet` funciona bem com ETL incremental.
**Cuidado**: a Lambda atual do customizador ainda escreve lá. **Não deletar antes** de modificar a Lambda do customizador OU sincronizar o cron mensal.
**Benefício**: economia de storage S3 (atualmente 172MB → será 0).

---

## 🟢 Baixa prioridade / Cleanup

### [ ] 8. Bug do HTML literal como produto (mencionado no CONTEXTO_COWORK_BI.md)
Algumas entradas têm produto = código HTML/JS literal:
```
<!-- eventos da aws -->
<script>
  const produto = document.body.getAttribute(...
```
**Causa provável**: race condition no `index.html` (JS dispara evento antes do atributo `data-produto-id` estar definido).
**Fix**: revisar `index.html` do customizador.

### [ ] 9. Considerar `ANALYTICS_REFRESH_SECRET`
**Atual**: endpoint `/api/analytics/[alias]/refresh` está aberto (sem auth).
**Risco**: alguém pode fazer DDOS ferver Athena (~$0.005/query × N).
**Fix**: setar env var no Amplify + na Lambda `analytics-compute`. Frontend admin precisaria de cookie/sessão.
**Adia**: low risk hoje, baixo tráfego.

### [ ] 10. Decompor `Portal.tsx`
**Atual**: 3400+ linhas num arquivo só.
**Fix**: dividir em componentes por feature (analytics/, contracts/, blocks/, etc.).
**Adia**: cosmético, não bloqueia features.

### [ ] 11. Migrar dados in-memory pra Prisma + PostgreSQL
**Atual**: USERS, BLOCKS, ACTIVITIES, ASSETS são arrays em memória — perdem ao recarregar.
**Fix**: schema Prisma já existe em `docs/schema.prisma`. Falta:
- [ ] Setar RDS PostgreSQL ou Supabase
- [ ] `npx prisma migrate dev`
- [ ] Refatorar Portal.tsx pra usar Prisma client
**Adia**: MVP funciona sem isso, mas é importante pra produção real.

---

## 📦 Onde estão as coisas

| Recurso | Local |
|---|---|
| Portal (Next.js) | https://github.com/arxpalhano/att |
| Deploy URL | https://main.d20t94dp8646px.amplifyapp.com |
| Lambda parquet-monthly-etl (código) | `lambda/parquet-monthly-etl/` |
| Lambda analytics-compute (código) | `lambda/analytics-compute/` |
| Guia de deploy Amplify | `DEPLOY_AMPLIFY.md` |
| Tabela Parquet (Athena) | `customizador_events.eventos_parquet` |
| Storage analytics (S3) | `s3://archtechtour-assets/analytics-cache/` |
| Tabela JSON original (Athena) | `customizador_events.eventos_customizador` (ainda escrita, mas não usada pelas views) |
| Bucket eventos (S3) | `s3://explorar.archtechtour.com/eventos/` (Lambda customizador escreve aqui) |
| IAM Role do Amplify SSR | `arn:aws:iam::891377125620:role/amplify-archtechtour-portal-ssr` |

---

## 📊 O que está funcionando hoje

- [x] Portal Next.js em produção (Amplify Hosting, sa-east-1)
- [x] IAM Role com permissões Athena + S3 anexada no Amplify SSR + Compute
- [x] Tabela `eventos_parquet` particionada por `dt` (YYYY-MM-DD)
- [x] View `vw_eventos_base_com_cliente` lendo do Parquet (queries 15-21x mais rápidas)
- [x] Endpoints /api/analytics/[client] (GET) e /refresh (POST) funcionando
- [x] Endpoint /api/analytics/clients (GET dim, POST insert) funcionando
- [x] Admin UI: gerenciar clientes do dim + refresh por cliente
- [x] Cliente UI: dashboard com date range picker
- [x] 3 dashboards de exemplo em produção (RS Design, Cadeiras Rosa, Pedro Franco)
