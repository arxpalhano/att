#!/usr/bin/env bash
# Infra dos Perfis de Acesso (rodar UMA vez, com o profile att-admin).
#  1. Tabela DynamoDB att-profiles
#  2. att-profiles na policy DynamoDBPortalAccess do role SSR do Amplify
# Sem o item 2 o portal recebe AccessDenied ao ler os perfis — nesse caso ele cai
# nos perfis padrão do código (comportamento de antes) e avisa na tela de Perfis.
set -euo pipefail
PROFILE="${AWS_PROFILE:-att-admin}"
ROLE="amplify-archtechtour-portal-ssr"
POLICY="DynamoDBPortalAccess"
TABLE="att-profiles"
TMP="$(mktemp -d)"

echo "== 1/2 tabela $TABLE"
if aws dynamodb describe-table --table-name "$TABLE" --region us-east-1 --profile "$PROFILE" >/dev/null 2>&1; then
  echo "   já existe"
else
  aws dynamodb create-table --table-name "$TABLE" \
    --attribute-definitions AttributeName=id,AttributeType=S \
    --key-schema AttributeName=id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST --region us-east-1 --profile "$PROFILE" >/dev/null
  echo "   criada"
fi

echo "== 2/2 policy $POLICY do role $ROLE"
aws iam get-role-policy --role-name "$ROLE" --policy-name "$POLICY" --profile "$PROFILE" --output json \
  | python3 -c '
import json,sys
d=json.load(sys.stdin)["PolicyDocument"]
res=d["Statement"][0]["Resource"]
arn="arn:aws:dynamodb:us-east-1:891377125620:table/att-profiles"
if arn not in res: res.append(arn)
json.dump(d,open(sys.argv[1],"w"),indent=1)' "$TMP/policy.json"
aws iam put-role-policy --role-name "$ROLE" --policy-name "$POLICY" --policy-document "file://$TMP/policy.json" --profile "$PROFILE"
rm -rf "$TMP"
echo "== pronto (a permissão leva alguns minutos para propagar na Lambda)"
