#!/usr/bin/env bash
# Cria (ou atualiza) o webhook do Asaas apontando para o portal.
# Rodar DEPOIS do deploy (o Asaas pausa a fila após 15 falhas seguidas de entrega).
#
#   ASAAS_API_KEY='...' ASAAS_WEBHOOK_TOKEN='...' scripts/finance-webhook.sh [sandbox|production] [URL]
#
# Lê as variáveis do .env.local se não vierem no ambiente. O token tem que ser o
# MESMO configurado no Amplify (ASAAS_WEBHOOK_TOKEN) — é ele que o endpoint valida.
set -euo pipefail
ENV_NAME="${1:-sandbox}"
APP_URL="${2:-https://app.archtechtour.com}"
if [[ -z "${ASAAS_API_KEY:-}" || -z "${ASAAS_WEBHOOK_TOKEN:-}" ]]; then
  ASAAS_API_KEY=$(grep -E '^ASAAS_API_KEY=' .env.local | cut -d= -f2- | sed 's/^\\//')
  ASAAS_WEBHOOK_TOKEN=$(grep -E '^ASAAS_WEBHOOK_TOKEN=' .env.local | cut -d= -f2-)
fi
if [[ "$ENV_NAME" == "production" ]]; then BASE="https://api.asaas.com/v3"; else BASE="https://api-sandbox.asaas.com/v3"; fi
NAME="Portal ATT ($ENV_NAME)"
URL="$APP_URL/api/finance/webhook"
EVENTS='["PAYMENT_CREATED","PAYMENT_UPDATED","PAYMENT_CONFIRMED","PAYMENT_RECEIVED","PAYMENT_OVERDUE","PAYMENT_DELETED","PAYMENT_RESTORED","PAYMENT_REFUNDED","PAYMENT_PARTIALLY_REFUNDED","PAYMENT_REFUND_IN_PROGRESS","PAYMENT_RECEIVED_IN_CASH_UNDONE","PAYMENT_CHARGEBACK_REQUESTED","PAYMENT_CHARGEBACK_DISPUTE","PAYMENT_AWAITING_CHARGEBACK_REVERSAL","PAYMENT_DUNNING_REQUESTED","PAYMENT_DUNNING_RECEIVED","PAYMENT_BANK_SLIP_CANCELLED","PAYMENT_ANTICIPATED","PAYMENT_AUTHORIZED","PAYMENT_AWAITING_RISK_ANALYSIS","PAYMENT_APPROVED_BY_RISK_ANALYSIS","PAYMENT_REPROVED_BY_RISK_ANALYSIS","SUBSCRIPTION_CREATED","SUBSCRIPTION_UPDATED","SUBSCRIPTION_INACTIVATED","SUBSCRIPTION_DELETED","INVOICE_CREATED","INVOICE_UPDATED","INVOICE_AUTHORIZED","INVOICE_CANCELED","INVOICE_CANCELLATION_DENIED","INVOICE_ERROR","INVOICE_PROCESSING_CANCELLATION","INVOICE_SYNCHRONIZED"]'
BODY=$(python3 - "$NAME" "$URL" "$ASAAS_WEBHOOK_TOKEN" "$EVENTS" <<'EOF'
import json,sys
print(json.dumps({"name":sys.argv[1],"url":sys.argv[2],"email":"financeiro@archtechtour.com","enabled":True,"interrupted":False,"apiVersion":3,"authToken":sys.argv[3],"sendType":"SEQUENTIALLY","events":json.loads(sys.argv[4])}))
EOF
)
EXISTING=$(curl -s -H "access_token: $ASAAS_API_KEY" "$BASE/webhooks" | python3 -c "import json,sys; d=json.load(sys.stdin); print(next((w['id'] for w in d.get('data',[]) if w.get('url')=='$URL'),''))")
if [[ -n "$EXISTING" ]]; then
  echo "== atualizando webhook $EXISTING"
  curl -s -H "access_token: $ASAAS_API_KEY" -H 'content-type: application/json' -X PUT "$BASE/webhooks/$EXISTING" -d "$BODY"
else
  echo "== criando webhook"
  curl -s -H "access_token: $ASAAS_API_KEY" -H 'content-type: application/json' -X POST "$BASE/webhooks" -d "$BODY"
fi
echo; echo "== pronto ($ENV_NAME → $URL)"
