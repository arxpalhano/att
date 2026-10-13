#!/usr/bin/env bash
# Infra do Módulo Financeiro (rodar UMA vez, com o profile att-admin).
#  1. Tabela DynamoDB att-finance (espelho do Asaas) com TTL em `expiresAt`
#     (só os registros de evento de webhook têm TTL — 30 dias)
#  2. att-finance na policy DynamoDBPortalAccess do role SSR do Amplify
#  3. Cron diário (EventBridge → API destination) chamando POST /api/finance/sync
#     com o header x-finance-secret = FINANCE_SYNC_SECRET (passar via env ao rodar)
# Depois: configurar as env vars no Amplify (ASAAS_API_KEY, ASAAS_ENV,
# ASAAS_WEBHOOK_TOKEN, FINANCE_SYNC_SECRET) e criar o webhook no Asaas
# (scripts/finance-webhook.sh).
set -euo pipefail
PROFILE="${AWS_PROFILE:-att-admin}"
REGION=us-east-1
ROLE="amplify-archtechtour-portal-ssr"
POLICY="DynamoDBPortalAccess"
TABLE="att-finance"
ACCOUNT=891377125620
APP_URL="${APP_URL:-https://app.archtechtour.com}"
TMP="$(mktemp -d)"

echo "== 1/3 tabela $TABLE"
if aws dynamodb describe-table --table-name "$TABLE" --region $REGION --profile "$PROFILE" >/dev/null 2>&1; then
  echo "   já existe"
else
  aws dynamodb create-table --table-name "$TABLE" \
    --attribute-definitions AttributeName=id,AttributeType=S \
    --key-schema AttributeName=id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST --region $REGION --profile "$PROFILE" >/dev/null
  aws dynamodb wait table-exists --table-name "$TABLE" --region $REGION --profile "$PROFILE"
  aws dynamodb update-time-to-live --table-name "$TABLE" --time-to-live-specification "Enabled=true, AttributeName=expiresAt" --region $REGION --profile "$PROFILE" >/dev/null
  echo "   criada (TTL em expiresAt)"
fi

echo "== 2/3 policy $POLICY do role $ROLE"
aws iam get-role-policy --role-name "$ROLE" --policy-name "$POLICY" --profile "$PROFILE" --output json \
  | python3 -c '
import json,sys
d=json.load(sys.stdin)["PolicyDocument"]
res=d["Statement"][0]["Resource"]
arn="arn:aws:dynamodb:us-east-1:891377125620:table/att-finance"
if arn not in res: res.append(arn)
json.dump(d,open(sys.argv[1],"w"),indent=1)' "$TMP/policy.json"
aws iam put-role-policy --role-name "$ROLE" --policy-name "$POLICY" --policy-document "file://$TMP/policy.json" --profile "$PROFILE"
echo "   ok"

echo "== 3/3 cron diário finance-sync (EventBridge API destination)"
if [[ -z "${FINANCE_SYNC_SECRET:-}" ]]; then
  echo "   FINANCE_SYNC_SECRET não informado — pulando o cron. Rode: FINANCE_SYNC_SECRET=... $0"
else
  CONN_ARN=$(aws events describe-connection --name finance-sync --region $REGION --profile "$PROFILE" --query ConnectionArn --output text 2>/dev/null || true)
  if [[ -z "$CONN_ARN" || "$CONN_ARN" == "None" ]]; then
    CONN_ARN=$(aws events create-connection --name finance-sync --authorization-type API_KEY \
      --auth-parameters "{\"ApiKeyAuthParameters\":{\"ApiKeyName\":\"x-finance-secret\",\"ApiKeyValue\":\"$FINANCE_SYNC_SECRET\"}}" \
      --region $REGION --profile "$PROFILE" --query ConnectionArn --output text)
  else
    aws events update-connection --name finance-sync --authorization-type API_KEY \
      --auth-parameters "{\"ApiKeyAuthParameters\":{\"ApiKeyName\":\"x-finance-secret\",\"ApiKeyValue\":\"$FINANCE_SYNC_SECRET\"}}" \
      --region $REGION --profile "$PROFILE" >/dev/null
  fi
  DEST_ARN=$(aws events describe-api-destination --name finance-sync --region $REGION --profile "$PROFILE" --query ApiDestinationArn --output text 2>/dev/null || true)
  if [[ -z "$DEST_ARN" || "$DEST_ARN" == "None" ]]; then
    DEST_ARN=$(aws events create-api-destination --name finance-sync --connection-arn "$CONN_ARN" \
      --invocation-endpoint "$APP_URL/api/finance/sync" --http-method POST --invocation-rate-limit-per-second 1 \
      --region $REGION --profile "$PROFILE" --query ApiDestinationArn --output text)
  fi
  # Role que o EventBridge assume para invocar o API destination
  if ! aws iam get-role --role-name events-finance-sync-role --profile "$PROFILE" >/dev/null 2>&1; then
    aws iam create-role --role-name events-finance-sync-role --profile "$PROFILE" \
      --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"events.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
    aws iam put-role-policy --role-name events-finance-sync-role --policy-name invoke-api-destination --profile "$PROFILE" \
      --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"events:InvokeApiDestination\",\"Resource\":\"$DEST_ARN\"}]}"
    sleep 10
  fi
  # 06h UTC = 03h em São Paulo, todo dia
  aws events put-rule --name finance-sync-daily --schedule-expression "cron(0 6 * * ? *)" --state ENABLED --region $REGION --profile "$PROFILE" >/dev/null
  aws events put-targets --rule finance-sync-daily --region $REGION --profile "$PROFILE" \
    --targets "[{\"Id\":\"finance-sync\",\"Arn\":\"$DEST_ARN\",\"RoleArn\":\"arn:aws:iam::$ACCOUNT:role/events-finance-sync-role\",\"Input\":\"{}\"}]" >/dev/null
  echo "   regra finance-sync-daily → $APP_URL/api/finance/sync (03h São Paulo)"
fi
rm -rf "$TMP"
echo "== pronto"
