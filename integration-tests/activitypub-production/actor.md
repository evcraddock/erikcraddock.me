# Test: Actor Endpoint

Verify the Actor endpoint returns correct ActivityPub data with https URLs.

## Endpoint

```
GET https://erikcraddock.me/users/erik
Accept: application/activity+json
```

## Command

```bash
curl -s -H "Accept: application/activity+json" https://erikcraddock.me/users/erik | jq .
```

## Expected Response Structure

```json
{
  "@context": [...],
  "type": "Person",
  "id": "https://erikcraddock.me/users/erik",
  "inbox": "https://erikcraddock.me/users/erik/inbox",
  "outbox": "https://erikcraddock.me/users/erik/outbox",
  "followers": "https://erikcraddock.me/users/erik/followers",
  "following": "https://erikcraddock.me/users/erik/following",
  "url": "https://erikcraddock.me/",
  "preferredUsername": "erik",
  "name": "...",
  "publicKey": {
    "id": "https://erikcraddock.me/users/erik#main-key",
    "owner": "https://erikcraddock.me/users/erik",
    "publicKeyPem": "-----BEGIN PUBLIC KEY-----..."
  }
}
```

## Verifications

Run these checks against the response:

### 1. All core URLs use https

```bash
curl -s -H "Accept: application/activity+json" https://erikcraddock.me/users/erik | jq -r '
  .id, .inbox, .outbox, .followers, .following, .url
' | grep -v "^https://" && echo "FAIL: Found non-https URL" || echo "PASS: All core URLs use https"
```

### 2. Public key URLs use https

```bash
curl -s -H "Accept: application/activity+json" https://erikcraddock.me/users/erik | jq -r '
  .publicKey.id, .publicKey.owner
' | grep -v "^https://" && echo "FAIL: Found non-https key URL" || echo "PASS: Public key URLs use https"
```

### 3. Type is Person

```bash
curl -s -H "Accept: application/activity+json" https://erikcraddock.me/users/erik | jq -r '.type' | grep -q "Person" && echo "PASS: Type is Person" || echo "FAIL: Type is not Person"
```

### 4. preferredUsername is erik

```bash
curl -s -H "Accept: application/activity+json" https://erikcraddock.me/users/erik | jq -r '.preferredUsername' | grep -q "erik" && echo "PASS: preferredUsername is erik" || echo "FAIL: preferredUsername mismatch"
```

### 5. Public key is present and valid format

```bash
curl -s -H "Accept: application/activity+json" https://erikcraddock.me/users/erik | jq -r '.publicKey.publicKeyPem' | grep -q "BEGIN PUBLIC KEY" && echo "PASS: Public key present" || echo "FAIL: Public key missing or invalid"
```

## Quick All-in-One Check

```bash
ACTOR=$(curl -s -H "Accept: application/activity+json" https://erikcraddock.me/users/erik)

echo "=== Actor Endpoint Tests ==="
echo

# Check all URLs are https
URLS=$(echo "$ACTOR" | jq -r '[.id, .inbox, .outbox, .followers, .following, .url, .publicKey.id, .publicKey.owner] | .[]')
if echo "$URLS" | grep -qv "^https://"; then
  echo "❌ FAIL: Found non-https URL"
  echo "$URLS" | grep -v "^https://"
else
  echo "✅ All URLs use https"
fi

# Check type
TYPE=$(echo "$ACTOR" | jq -r '.type')
[ "$TYPE" = "Person" ] && echo "✅ Type is Person" || echo "❌ Type is: $TYPE"

# Check username
USERNAME=$(echo "$ACTOR" | jq -r '.preferredUsername')
[ "$USERNAME" = "erik" ] && echo "✅ preferredUsername is erik" || echo "❌ preferredUsername is: $USERNAME"

# Check public key
echo "$ACTOR" | jq -r '.publicKey.publicKeyPem' | grep -q "BEGIN PUBLIC KEY" && echo "✅ Public key present" || echo "❌ Public key missing"

echo
echo "=== Done ==="
```

## Failure Scenarios

If any test fails:

1. **Non-https URLs**: Check proxy configuration, `X-Forwarded-Proto` header handling
2. **Missing public key**: Check actor key generation on startup
3. **Wrong type/username**: Check federation configuration
