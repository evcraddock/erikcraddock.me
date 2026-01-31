# Test: Outbox Endpoint

Verify the Outbox collection and paginated pages return correct ActivityPub data with https URLs.

## Endpoints

- Collection: `GET https://erikcraddock.me/users/erik/outbox`
- First page: `GET https://erikcraddock.me/users/erik/outbox?cursor=0`

## Part 1: Outbox Collection

### Command

```bash
curl -s -H "Accept: application/activity+json" https://erikcraddock.me/users/erik/outbox | jq .
```

### Expected Response Structure

```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "OrderedCollection",
  "id": "https://erikcraddock.me/users/erik/outbox",
  "totalItems": <number>,
  "first": "https://erikcraddock.me/users/erik/outbox?cursor=0"
}
```

### Verifications

```bash
OUTBOX=$(curl -s -H "Accept: application/activity+json" https://erikcraddock.me/users/erik/outbox)

echo "=== Outbox Collection Tests ==="
echo

# Check id is https
ID=$(echo "$OUTBOX" | jq -r '.id')
[[ "$ID" == https://* ]] && echo "✅ id uses https" || echo "❌ id is: $ID"

# Check first is https
FIRST=$(echo "$OUTBOX" | jq -r '.first')
[[ "$FIRST" == https://* ]] && echo "✅ first uses https" || echo "❌ first is: $FIRST"

# Check type
TYPE=$(echo "$OUTBOX" | jq -r '.type')
[ "$TYPE" = "OrderedCollection" ] && echo "✅ Type is OrderedCollection" || echo "❌ Type is: $TYPE"

# Check totalItems exists and is > 0
TOTAL=$(echo "$OUTBOX" | jq -r '.totalItems')
[ "$TOTAL" -gt 0 ] 2>/dev/null && echo "✅ totalItems is $TOTAL" || echo "❌ totalItems is: $TOTAL"

echo
```

## Part 2: Outbox Page (Paginated)

### Command

```bash
curl -s -H "Accept: application/activity+json" "https://erikcraddock.me/users/erik/outbox?cursor=0" | jq .
```

### Expected Response Structure

```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "OrderedCollectionPage",
  "id": "https://erikcraddock.me/users/erik/outbox?cursor=0",
  "partOf": "https://erikcraddock.me/users/erik/outbox",
  "next": "https://erikcraddock.me/users/erik/outbox?cursor=<number>",
  "orderedItems": [
    {
      "type": "Create",
      "id": "https://erikcraddock.me/...",
      "actor": "https://erikcraddock.me/users/erik",
      "object": { ... }
    }
  ]
}
```

### Verifications

```bash
PAGE=$(curl -s -H "Accept: application/activity+json" "https://erikcraddock.me/users/erik/outbox?cursor=0")

echo "=== Outbox Page Tests ==="
echo

# Check id is https
ID=$(echo "$PAGE" | jq -r '.id')
[[ "$ID" == https://* ]] && echo "✅ id uses https" || echo "❌ id is: $ID"

# Check partOf is https
PARTOF=$(echo "$PAGE" | jq -r '.partOf')
[[ "$PARTOF" == https://* ]] && echo "✅ partOf uses https" || echo "❌ partOf is: $PARTOF"

# Check next is https (if present)
NEXT=$(echo "$PAGE" | jq -r '.next // empty')
if [ -n "$NEXT" ]; then
  [[ "$NEXT" == https://* ]] && echo "✅ next uses https" || echo "❌ next is: $NEXT"
else
  echo "ℹ️  next not present (may be last page)"
fi

# Check type
TYPE=$(echo "$PAGE" | jq -r '.type')
[ "$TYPE" = "OrderedCollectionPage" ] && echo "✅ Type is OrderedCollectionPage" || echo "❌ Type is: $TYPE"

# Check orderedItems exists and has items
ITEMS=$(echo "$PAGE" | jq -r '.orderedItems | length')
[ "$ITEMS" -gt 0 ] 2>/dev/null && echo "✅ orderedItems has $ITEMS items" || echo "❌ orderedItems is empty or missing"

# Check first activity has https URLs
FIRST_ACTIVITY_ID=$(echo "$PAGE" | jq -r '.orderedItems[0].id // empty')
if [ -n "$FIRST_ACTIVITY_ID" ]; then
  [[ "$FIRST_ACTIVITY_ID" == https://* ]] && echo "✅ First activity id uses https" || echo "❌ First activity id is: $FIRST_ACTIVITY_ID"

  ACTOR=$(echo "$PAGE" | jq -r '.orderedItems[0].actor // empty')
  [[ "$ACTOR" == https://* ]] && echo "✅ First activity actor uses https" || echo "❌ First activity actor is: $ACTOR"
fi

echo
```

## Quick All-in-One Check

```bash
echo "=== Outbox Endpoint Tests ==="
echo

# Collection
OUTBOX=$(curl -s -H "Accept: application/activity+json" https://erikcraddock.me/users/erik/outbox)
echo "--- Collection ---"
echo "$OUTBOX" | jq -r '[.id, .first] | .[]' | while read url; do
  [[ "$url" == https://* ]] && echo "✅ $url" || echo "❌ $url"
done
TOTAL=$(echo "$OUTBOX" | jq -r '.totalItems')
echo "totalItems: $TOTAL"
echo

# Page
PAGE=$(curl -s -H "Accept: application/activity+json" "https://erikcraddock.me/users/erik/outbox?cursor=0")
echo "--- Page (cursor=0) ---"
echo "$PAGE" | jq -r '[.id, .partOf, .next // empty] | .[] | select(. != "")' | while read url; do
  [[ "$url" == https://* ]] && echo "✅ $url" || echo "❌ $url"
done
ITEMS=$(echo "$PAGE" | jq -r '.orderedItems | length')
echo "orderedItems count: $ITEMS"

echo
echo "=== Done ==="
```

## Failure Scenarios

If any test fails:

1. **Non-https URLs**: Check proxy configuration, URL rewriting in federation code
2. **Empty orderedItems**: Check if posts are published and federation is creating activities
3. **totalItems is 0**: No published posts, or federation not tracking them
