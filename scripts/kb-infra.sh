#!/usr/bin/env bash
# Infra da Base de Conhecimento (rodar UMA vez, com o profile att-admin).
#
#  1. Tabela DynamoDB att-kb            (já criada em 2026-09-08)
#  2. Policy DynamoDBPortalAccess       + att-kb e s3:DeleteObject em archtechtour-assets/kb/*
#  3. CORS do bucket archtechtour-assets + origem https://app.archtechtour.com
#
# Sem o item 2 o portal recebe AccessDenied ao ler/gravar a KB (a tela avisa e o
# resto do portal continua). Sem o item 3 o upload de anexo direto do browser
# falha no PUT pré-assinado (o bucket só liberava archtechtour.com e localhost).
set -euo pipefail
PROFILE="${AWS_PROFILE:-att-admin}"
ROLE="amplify-archtechtour-portal-ssr"
POLICY="DynamoDBPortalAccess"
BUCKET="archtechtour-assets"
TMP="$(mktemp -d)"

echo "== 1/3 tabela att-kb"
if aws dynamodb describe-table --table-name att-kb --region us-east-1 --profile "$PROFILE" >/dev/null 2>&1; then
  echo "   já existe"
else
  aws dynamodb create-table --table-name att-kb \
    --attribute-definitions AttributeName=id,AttributeType=S \
    --key-schema AttributeName=id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST --region us-east-1 --profile "$PROFILE" >/dev/null
  echo "   criada"
fi

echo "== 2/3 policy $POLICY do role $ROLE"
aws iam get-role-policy --role-name "$ROLE" --policy-name "$POLICY" --profile "$PROFILE" --output json \
  | python3 -c '
import json,sys
d=json.load(sys.stdin)["PolicyDocument"]
res=d["Statement"][0]["Resource"]
arn="arn:aws:dynamodb:us-east-1:891377125620:table/att-kb"
if arn not in res: res.append(arn)
if not any(s.get("Sid")=="KbAttachments" for s in d["Statement"]):
    d["Statement"].append({"Sid":"KbAttachments","Effect":"Allow",
        "Action":["s3:GetObject","s3:PutObject","s3:DeleteObject"],
        "Resource":"arn:aws:s3:::archtechtour-assets/kb/*"})
json.dump(d,open(sys.argv[1],"w"),indent=1)' "$TMP/policy.json"
aws iam put-role-policy --role-name "$ROLE" --policy-name "$POLICY" --policy-document "file://$TMP/policy.json" --profile "$PROFILE"
echo "   ok"

echo "== 3/3 CORS do bucket $BUCKET"
aws s3api get-bucket-cors --bucket "$BUCKET" --profile "$PROFILE" --output json \
  | python3 -c '
import json,sys
d=json.load(sys.stdin)
o=d["CORSRules"][0]["AllowedOrigins"]
for x in ["https://app.archtechtour.com","https://www.archtechtour.com"]:
    if x not in o: o.append(x)
json.dump(d,open(sys.argv[1],"w"))
print("   origens:", ", ".join(o))' "$TMP/cors.json"
aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration "file://$TMP/cors.json" --profile "$PROFILE"
echo "   ok"
rm -rf "$TMP"
echo "== pronto"
