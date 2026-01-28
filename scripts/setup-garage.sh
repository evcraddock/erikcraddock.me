#!/bin/bash
# Setup Garage for local development (run once after first `make dev`)
#
# Reads from .env:
#   GARAGE_ADMIN_TOKEN - Admin API token (must match garage.toml)
#   S3_BUCKET - Bucket name to create
#
# Creates the cluster layout, API key, and bucket.
# Only needs to run once - data persists in Docker volumes.

set -e

# Load .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

GARAGE_ADMIN="http://localhost:3903"
ADMIN_TOKEN="${GARAGE_ADMIN_TOKEN:-dev-admin-token}"
BUCKET_NAME="${S3_BUCKET:-erikcraddock}"

garage_api() {
  curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$@"
}

echo "🚀 Setting up Garage..."

# Wait for admin API
echo "Waiting for Garage admin API..."
for i in {1..30}; do
  if garage_api "$GARAGE_ADMIN/health" > /dev/null 2>&1; then
    break
  fi
  [ $i -eq 30 ] && { echo "❌ Garage admin API not responding"; exit 1; }
  sleep 1
done

# Check/configure layout
LAYOUT=$(garage_api "$GARAGE_ADMIN/v1/layout")
VERSION=$(echo "$LAYOUT" | jq -r '.version // 0')

if [ "$VERSION" -gt 0 ]; then
  echo "✓ Layout already configured"
else
  NODE_ID=$(garage_api "$GARAGE_ADMIN/v1/status" | jq -r '.node')
  [ -z "$NODE_ID" ] || [ "$NODE_ID" = "null" ] && { echo "❌ Failed to get node ID"; exit 1; }
  
  garage_api -X POST "$GARAGE_ADMIN/v1/layout" \
    -H "Content-Type: application/json" \
    -d "[{\"id\":\"$NODE_ID\",\"zone\":\"dc1\",\"capacity\":1073741824}]" > /dev/null
  garage_api -X POST "$GARAGE_ADMIN/v1/layout/apply" \
    -H "Content-Type: application/json" \
    -d '{"version":1}' > /dev/null
  echo "✓ Layout configured"
fi

# Check/create API key
KEYS=$(garage_api "$GARAGE_ADMIN/v1/key")
KEY_ID=$(echo "$KEYS" | jq -r '.[] | select(.name == "dev-key") | .id')

if [ -n "$KEY_ID" ] && [ "$KEY_ID" != "null" ]; then
  KEY_INFO=$(garage_api "$GARAGE_ADMIN/v1/key?id=$KEY_ID")
else
  KEY_INFO=$(garage_api -X POST "$GARAGE_ADMIN/v1/key" -H "Content-Type: application/json" -d '{"name":"dev-key"}')
  echo "✓ API key created"
fi

ACCESS_KEY=$(echo "$KEY_INFO" | jq -r '.accessKeyId')
SECRET_KEY=$(echo "$KEY_INFO" | jq -r '.secretAccessKey')

# Check/create bucket
BUCKETS=$(garage_api "$GARAGE_ADMIN/v1/bucket")
BUCKET_ID=$(echo "$BUCKETS" | jq -r ".[] | select(.globalAliases[]? == \"$BUCKET_NAME\") | .id")

if [ -z "$BUCKET_ID" ] || [ "$BUCKET_ID" = "null" ]; then
  BUCKET_ID=$(garage_api -X POST "$GARAGE_ADMIN/v1/bucket" \
    -H "Content-Type: application/json" \
    -d "{\"globalAlias\":\"$BUCKET_NAME\"}" | jq -r '.id')
  echo "✓ Bucket created"
fi

# Grant permissions
garage_api -X POST "$GARAGE_ADMIN/v1/bucket/allow" \
  -H "Content-Type: application/json" \
  -d "{\"bucketId\":\"$BUCKET_ID\",\"accessKeyId\":\"$ACCESS_KEY\",\"permissions\":{\"read\":true,\"write\":true,\"owner\":true}}" > /dev/null

echo ""
echo "✅ Garage ready! Add to .env:"
echo "  S3_ACCESS_KEY=$ACCESS_KEY"
echo "  S3_SECRET_KEY=$SECRET_KEY"
