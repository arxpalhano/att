# Lambda: site-watchdog — agente **Argus Watchtower**

Vigia se os sites da ArchTechTour estão no ar e avisa a equipe por e-mail.
É o backend do agente **Argus Watchtower**, que aparece no portal em
**Agentes AI → Argus Watchtower** (`/portal`, admin).

---

## Como funciona

```
EventBridge "site-watchdog-hourly"  →  cron(0 * * * ? *)   (DE HORA EM HORA)
        │
        ▼
   Lambda site-watchdog
        │  1. lê a rotina em DynamoDB att-agent-routines (item "argus-watchtower")
        │  2. a hora atual em America/Sao_Paulo está em routine.hours? (padrão 13 e 21)
        │     não → sai sem fazer nada · sim → segue
        │  3. grava um lock idempotente do slot (att-agent-checks, id = agente#DATA T HORA)
        │  4. testa cada URL (retry configurável, pra não alarmar por blip de rede)
        │  5. envia e-mail via SES pros destinatários da rotina
        │  6. grava o resultado no histórico que o portal exibe (TTL 90 dias)
```

**Por que "de hora em hora" e não `cron(0 16,0 * * ? *)`:** assim os horários ficam
**editáveis pelo portal** — mudar 13h/21h é só salvar a rotina no DynamoDB, sem
redeploy da Lambda, sem mexer em EventBridge e sem dar permissão de IAM pro portal
alterar regras de agendamento.

**Por que a Lambda é independente do Next.js:** se `app.archtechtour.com` cair, o
monitoramento precisa continuar rodando e avisando. Por isso ela repete a lógica de
probe/e-mail de `src/lib/watchdog.ts` em vez de chamar o portal.
⚠️ **Ao mexer em `src/lib/watchdog.ts`, replique aqui** (e vice-versa).

---

## Recursos AWS (já criados)

| Recurso | Valor |
|---|---|
| Lambda | `site-watchdog` · nodejs20.x · 256MB · timeout 120s · us-east-1 |
| Role | `lambda-site-watchdog-role` (basic execution + DynamoDB nas 2 tabelas + `ses:SendEmail`) |
| EventBridge | `site-watchdog-hourly` → `cron(0 * * * ? *)` |
| DynamoDB | `att-agent-routines` (config) · `att-agent-checks` (histórico, TTL em `expiresAt`) |
| SES | identidade de domínio `archtechtour.com` (us-east-1), remetente `monitor@archtechtour.com` |

### Env vars da Lambda

| Variável | Valor |
|---|---|
| `TABLE_ROUTINES` | `att-agent-routines` |
| `TABLE_CHECKS` | `att-agent-checks` |
| `APP_AWS_REGION` | `us-east-1` |

---

## Deploy de uma alteração

```bash
cd lambda/site-watchdog
npm install      # só na primeira vez
npm run deploy   # tsc → zip → aws lambda update-function-code
```

---

## Testar na mão

```bash
# roda ignorando o horário e envia e-mail de verdade
aws lambda invoke --function-name site-watchdog --payload '{"force":true}' \
  /tmp/out.json --profile att-admin --region us-east-1 && cat /tmp/out.json

# roda como o EventBridge roda (respeita horário e o lock do slot)
aws lambda invoke --function-name site-watchdog --payload '{}' \
  /tmp/out.json --profile att-admin --region us-east-1 && cat /tmp/out.json

# logs
aws logs tail /aws/lambda/site-watchdog --since 1h --profile att-admin --region us-east-1
```

Pelo portal: **Agentes AI → Argus Watchtower → "Verificar e enviar e-mail"**
(esse caminho passa pelo Next.js, não pela Lambda, mas usa a mesma rotina).

---

## SES — atenção

A conta SES está em **sandbox** (`ProductionAccessEnabled: false`): só é possível
enviar para endereços/domínios **verificados**. Hoje estão verificados:

- domínio `archtechtour.com` (cobre `info@archtechtour.com`)
- `palhano@arx.hk` (identidade individual)

Para incluir um destinatário novo fora de `@archtechtour.com`, verifique antes:

```bash
aws sesv2 create-email-identity --email-identity NOVO@dominio.com \
  --region us-east-1 --profile att-admin
# a pessoa recebe um e-mail da AWS e precisa clicar no link
```

Ou peça **production access** no console do SES para liberar qualquer destinatário.
