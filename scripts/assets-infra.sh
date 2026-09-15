#!/usr/bin/env bash
# Infra da tabela de arquivos dos blocos (att-assets): cria a tabela e libera no
# policy DynamoDBPortalAccess do role SSR. Rodar uma vez com o profile att-admin.
set -euo pipefail
PROFILE="${AWS_PROFILE:-att-admin}"; ROLE="amplify-archtechtour-portal-ssr"; POLICY="DynamoDBPortalAccess"; TMP="$(mktemp -d)"
echo "== 1/2 tabela att-assets"
if aws dynamodb describe-table --table-name att-assets --region us-east-1 --profile "$PROFILE" >/dev/null 2>&1; then echo "   já existe"; else
  aws dynamodb create-table --table-name att-assets --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH --billing-mode PAY_PER_REQUEST --region us-east-1 --profile "$PROFILE" >/dev/null; echo "   criada"; fi
echo "== 2/2 policy $POLICY"
aws iam get-role-policy --role-name "$ROLE" --policy-name "$POLICY" --profile "$PROFILE" --output json | /opt/homebrew/bin/python3 -c '
import json,sys
d=json.load(sys.stdin)["PolicyDocument"]; res=d["Statement"][0]["Resource"]
arn="arn:aws:dynamodb:us-east-1:891377125620:table/att-assets"
if arn not in res: res.append(arn)
json.dump(d,open(sys.argv[1],"w"),indent=1)' "$TMP/policy.json"
aws iam put-role-policy --role-name "$ROLE" --policy-name "$POLICY" --policy-document "file://$TMP/policy.json" --profile "$PROFILE"; echo "   ok"; rm -rf "$TMP"; echo "== pronto"
