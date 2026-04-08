#!/bin/bash
# Lambda 자막 추출 API 배포 — Groq Whisper
set -euo pipefail

FUNCTION_NAME="youtube-subtitle-api"
REGION="ap-northeast-2"
RUNTIME="python3.11"
HANDLER="handler.lambda_handler"
TIMEOUT=180
MEMORY=512
ROLE_NAME="youtube-subtitle-lambda-role"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR=$(mktemp -d)

echo "=== 1. 패키징 ==="
pip3 install yt-dlp requests -t "$BUILD_DIR" --quiet
cp "$SCRIPT_DIR/handler.py" "$BUILD_DIR/"

cd "$BUILD_DIR"
zip -r9 "$SCRIPT_DIR/function.zip" . -x '*.pyc' '__pycache__/*' '*.dist-info/*' > /dev/null
cd "$SCRIPT_DIR"
rm -rf "$BUILD_DIR"

ZIP_SIZE=$(du -h function.zip | cut -f1)
echo "  패키지 크기: $ZIP_SIZE"

echo "=== 2. IAM Role ==="
ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text 2>/dev/null || echo "")

if [ -z "$ROLE_ARN" ]; then
  echo "  Role 생성 중..."
  TRUST_POLICY='{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'
  ROLE_ARN=$(aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST_POLICY" \
    --query 'Role.Arn' --output text)

  aws iam attach-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"

  echo "  Role 생성 완료. 10초 대기..."
  sleep 10
else
  echo "  기존 Role 사용: $ROLE_ARN"
fi

echo "=== 3. Lambda 함수 ==="
EXISTING=$(aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" 2>/dev/null || echo "")

if [ -z "$EXISTING" ]; then
  echo "  함수 생성 중..."
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime "$RUNTIME" \
    --handler "$HANDLER" \
    --role "$ROLE_ARN" \
    --zip-file "fileb://function.zip" \
    --timeout "$TIMEOUT" \
    --memory-size "$MEMORY" \
    --environment "Variables={GROQ_API_KEY=${GROQ_API_KEY:-}}" \
    --region "$REGION" \
    --query 'FunctionArn' --output text
else
  echo "  함수 업데이트 중..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file "fileb://function.zip" \
    --region "$REGION" \
    --query 'FunctionArn' --output text

  sleep 5

  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --runtime "$RUNTIME" \
    --handler "$HANDLER" \
    --timeout "$TIMEOUT" \
    --memory-size "$MEMORY" \
    --environment "Variables={GROQ_API_KEY=${GROQ_API_KEY:-}}" \
    --region "$REGION" > /dev/null 2>&1 || true
fi

echo "=== 4. API Gateway ==="
API_ID=$(aws apigatewayv2 get-apis --region "$REGION" \
  --query "Items[?Name=='$FUNCTION_NAME'].ApiId | [0]" --output text 2>/dev/null || echo "None")

if [ "$API_ID" = "None" ] || [ -z "$API_ID" ]; then
  echo "  API Gateway 생성 중..."
  API_ID=$(aws apigatewayv2 create-api \
    --name "$FUNCTION_NAME" \
    --protocol-type HTTP \
    --region "$REGION" \
    --query 'ApiId' --output text)

  FUNC_ARN=$(aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" \
    --query 'Configuration.FunctionArn' --output text)

  INTEGRATION_ID=$(aws apigatewayv2 create-integration \
    --api-id "$API_ID" \
    --integration-type AWS_PROXY \
    --integration-uri "$FUNC_ARN" \
    --payload-format-version "2.0" \
    --region "$REGION" \
    --query 'IntegrationId' --output text)

  aws apigatewayv2 create-route \
    --api-id "$API_ID" \
    --route-key "GET /transcript" \
    --target "integrations/$INTEGRATION_ID" \
    --region "$REGION" > /dev/null

  aws apigatewayv2 create-stage \
    --api-id "$API_ID" \
    --stage-name '$default' \
    --auto-deploy \
    --region "$REGION" > /dev/null

  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
  aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --statement-id apigateway-invoke \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*" \
    --region "$REGION" > /dev/null 2>&1 || true
else
  echo "  기존 API Gateway 사용: $API_ID"
fi

API_URL="https://${API_ID}.execute-api.${REGION}.amazonaws.com"

echo ""
echo "=== 배포 완료 ==="
echo "API URL: ${API_URL}/transcript?video_id=VIDEO_ID"
echo ""
echo "테스트:"
echo "  curl \"${API_URL}/transcript?video_id=p5WOwSw9xoc\""

rm -f "$SCRIPT_DIR/function.zip"
