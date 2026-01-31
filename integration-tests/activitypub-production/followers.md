# Test: Followers Endpoint

Verify the Followers collection returns correct ActivityPub data with https URLs.

## Endpoint

```
GET https://erikcraddock.me/users/erik/followers
Accept: application/activity+json
```

## Command

```bash
curl -s -H "Accept: application/activity+json" https://erikcraddock.me/users/erik/followers | jq .
```

## Expected Response Structure

For a collection (may be paginated if many followers):

```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "OrderedCollection",
  "id": "https://erikcraddock.me/users/erik/followers",
  "totalItems": <number>,
  "first": "https://erikcraddock.me/users/erik/followers?cursor=..."
}
```

Or for a small collection (items inline):

```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "OrderedCollection",
  "id": "https://erikcraddock.me/users/erik/followers",
  "totalItems": <number>,
  "orderedItems": [
    "https://mastodon.social/users/someone",
    ...
  ]
}
```

## Verifications

```bash
FOLLOWERS=$(curl -s -H "Accept: application/activity+json" https://erikcraddock.me/users/erik/followers)

echo "=== Followers Collection Tests ==="
echo

# Check id is https
ID=$(echo "$FOLLOWERS" | jq -r '.id')
[[ "$ID" == https://* ]] && echo "✅ id uses https" || echo "❌ id is: $ID"

# Check type
TYPE=$(echo "$FOLLOWERS" | jq -r '.type')
[ "$TYPE" = "OrderedCollection" ] && echo "✅ Type is OrderedCollection" || echo "❌ Type is: $TYPE"

# Check totalItems exists
TOTAL=$(echo "$FOLLOWERS" | jq -r '.totalItems')
echo "ℹ️  totalItems: $TOTAL"

# Check first is https (if present - for paginated collections)
FIRST=$(echo "$FOLLOWERS" | jq -r '.first // empty')
if [ -n "$FIRST" ]; then
  [[ "$FIRST" == https://* ]] && echo "✅ first uses https" || echo "❌ first is: $FIRST"
else
  echo "ℹ️  first not present (collection may not be paginated)"
fi

# Check orderedItems URLs are https (if present - for inline items)
ITEMS=$(echo "$FOLLOWERS" | jq -r '.orderedItems // [] | .[]' 2>/dev/null)
if [ -n "$ITEMS" ]; then
  echo "Checking orderedItems URLs..."
  echo "$ITEMS" | while read url; do
    [[ "$url" == https://* ]] && echo "  ✅ $url" || echo "  ❌ $url"
  done
else
  echo "ℹ️  orderedItems not present or empty"
fi

echo
echo "=== Done ==="
```

## Quick All-in-One Check

```bash
echo "=== Followers Endpoint Tests ==="
echo

FOLLOWERS=$(curl -s -H "Accept: application/activity+json" https://erikcraddock.me/users/erik/followers)

# Check all collection-level URLs
echo "--- Collection URLs ---"
echo "$FOLLOWERS" | jq -r '[.id, .first // empty] | .[] | select(. != "")' | while read url; do
  [[ "$url" == https://* ]] && echo "✅ $url" || echo "❌ $url"
done

# Stats
TYPE=$(echo "$FOLLOWERS" | jq -r '.type')
TOTAL=$(echo "$FOLLOWERS" | jq -r '.totalItems')
echo
echo "Type: $TYPE"
echo "Total followers: $TOTAL"

echo
echo "=== Done ==="
```

## Paginated Followers (if applicable)

If the collection is paginated, also test the first page:

```bash
# Get the first page URL from the collection
FIRST_URL=$(curl -s -H "Accept: application/activity+json" https://erikcraddock.me/users/erik/followers | jq -r '.first // empty')

if [ -n "$FIRST_URL" ]; then
  echo "Testing first page: $FIRST_URL"
  PAGE=$(curl -s -H "Accept: application/activity+json" "$FIRST_URL")

  # Check page URLs
  echo "$PAGE" | jq -r '[.id, .partOf, .next // empty, .prev // empty] | .[] | select(. != "")' | while read url; do
    [[ "$url" == https://* ]] && echo "✅ $url" || echo "❌ $url"
  done
fi
```

## Failure Scenarios

If any test fails:

1. **Non-https URLs**: Check proxy configuration, URL rewriting in federation code
2. **Wrong type**: Should be OrderedCollection
3. **Missing totalItems**: Check federation followers tracking
