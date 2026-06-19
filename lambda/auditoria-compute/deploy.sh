#!/usr/bin/env bash
# Deploy do Lambda auditoria-compute
# Pré-requisitos: AWS CLI com profile att-admin, Lambda já criado no console
#   ou criar via:
#     aws --profile att-admin lambda create-function \
#       --function-name auditoria-compute \
#       --runtime python3.12 \
#       --handler handler.handler \
#       --role arn:aws:iam::891377125620:role/lambda-auditoria-role \
#       --timeout 900 --memory-size 1024 --zip-file fileb://function.zip

set -euo pipefail
cd "$(dirname "$0")"

ZIP="function.zip"
PROFILE="${AWS_PROFILE:-att-admin}"
FUNCTION="auditoria-compute"

echo "==> Empacotando $ZIP"
rm -f "$ZIP"
zip -q "$ZIP" handler.py validar_produto.py

echo "==> Atualizando código no Lambda $FUNCTION (profile=$PROFILE)"
aws --profile "$PROFILE" lambda update-function-code \
  --function-name "$FUNCTION" \
  --zip-file "fileb://$ZIP" \
  --no-cli-pager

echo "==> Pronto. Tamanho do zip:"
ls -lh "$ZIP"
