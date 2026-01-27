#!/bin/bash
# Setup Garage for local development
# Run after `docker compose up -d garage`

set -e

GARAGE_ADMIN="http://localhost:3903"
BUCKET_NAME="erikcraddock-media"
ACCESS_KEY="dev-access-key"
SECRET_KEY="dev-secret-key"

echo "🚀 Setting up Garage..."

# Wait for Garage to be ready
echo "Waiting for Garage admin API..."
for i in {1..30}; do
  if curl -s "$GARAGE_ADMIN/health" > /dev/null 2>&1; then
    echo "Garage is ready!"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "❌ Garage failed to start"
    exit 1
  fi
  sleep 1
done

# Get cluster status and node ID
echo "Getting cluster status..."
STATUS=$(curl -s "$GARAGE_ADMIN/v1/status" -H "Content-Type: application/json")
NODE_ID=$(echo "$STATUS" | jq -r '.node')

if [ -z "$NODE_ID" ] || [ "$NODE_ID" = "null" ]; then
  echo "❌ Failed to get node ID"
  exit 1
fi

echo "Node ID: $NODE_ID"

# Configure the node with zone and capacity
echo "Configuring node layout..."
curl -s -X POST "$GARAGE_ADMIN/v1/layout" \
  -H "Content-Type: application/json" \
  -d "[{
    \"id\": \"$NODE_ID\",
    \"zone\": \"dc1\",
    \"capacity\": 1073741824,
    \"tags\": [\"dev\"]
  }]" > /dev/null

# Get current layout version and apply
LAYOUT=$(curl -s "$GARAGE_ADMIN/v1/layout")
VERSION=$(echo "$LAYOUT" | jq -r '.version')
NEXT_VERSION=$((VERSION + 1))

echo "Applying layout (version $NEXT_VERSION)..."
curl -s -X POST "$GARAGE_ADMIN/v1/layout/apply" \
  -H "Content-Type: application/json" \
  -d "{\"version\": $NEXT_VERSION}" > /dev/null

# Create API key
echo "Creating API key..."
KEY_RESULT=$(curl -s -X POST "$GARAGE_ADMIN/v1/key" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"dev-key\"
  }")

CREATED_ACCESS_KEY=$(echo "$KEY_RESULT" | jq -r '.accessKeyId')
CREATED_SECRET_KEY=$(echo "$KEY_RESULT" | jq -r '.secretAccessKey')

if [ -z "$CREATED_ACCESS_KEY" ] || [ "$CREATED_ACCESS_KEY" = "null" ]; then
  echo "⚠️  Key may already exist, checking..."
  # List keys and find dev-key
  KEYS=$(curl -s "$GARAGE_ADMIN/v1/key")
  EXISTING_KEY=$(echo "$KEYS" | jq -r '.[] | select(.name == "dev-key") | .id')
  if [ -n "$EXISTING_KEY" ]; then
    echo "Found existing key: $EXISTING_KEY"
    KEY_INFO=$(curl -s "$GARAGE_ADMIN/v1/key?id=$EXISTING_KEY")
    CREATED_ACCESS_KEY=$(echo "$KEY_INFO" | jq -r '.accessKeyId')
    CREATED_SECRET_KEY=$(echo "$KEY_INFO" | jq -r '.secretAccessKey')
  fi
fi

# Create bucket
echo "Creating bucket: $BUCKET_NAME..."
curl -s -X POST "$GARAGE_ADMIN/v1/bucket" \
  -H "Content-Type: application/json" \
  -d "{\"globalAlias\": \"$BUCKET_NAME\"}" > /dev/null 2>&1 || true

# Get bucket ID
BUCKETS=$(curl -s "$GARAGE_ADMIN/v1/bucket")
BUCKET_ID=$(echo "$BUCKETS" | jq -r ".[] | select(.globalAliases[]? == \"$BUCKET_NAME\") | .id")

if [ -z "$BUCKET_ID" ] || [ "$BUCKET_ID" = "null" ]; then
  echo "❌ Failed to create or find bucket"
  exit 1
fi

echo "Bucket ID: $BUCKET_ID"

# Grant key access to bucket
echo "Granting bucket access..."
curl -s -X POST "$GARAGE_ADMIN/v1/bucket/allow" \
  -H "Content-Type: application/json" \
  -d "{
    \"bucketId\": \"$BUCKET_ID\",
    \"accessKeyId\": \"$CREATED_ACCESS_KEY\",
    \"permissions\": {
      \"read\": true,
      \"write\": true,
      \"owner\": true
    }
  }" > /dev/null

echo ""
echo "✅ Garage setup complete!"
echo ""
echo "Add these to your .env file:"
echo "  S3_ENDPOINT=http://localhost:3900"
echo "  S3_ACCESS_KEY=$CREATED_ACCESS_KEY"
echo "  S3_SECRET_KEY=$CREATED_SECRET_KEY"
echo "  S3_BUCKET=$BUCKET_NAME"
echo "  S3_REGION=garage"
