# Test: Create Error Cases

Test validation and error handling for post creation.

## Missing Slug

```bash
cd cli
bun src/index.ts --config dev-config.yaml post create \
  --title "No Slug Post" \
  --content "This should fail"
```

**Expected:**

```
❌ Missing required option: --slug
Run 'ec post create --help' for usage.
```

## Missing Content

```bash
bun src/index.ts --config dev-config.yaml post create \
  --title "No Content Post" \
  --slug no-content-post
```

**Expected:**

```
❌ Missing required option: --content
Run 'ec post create --help' for usage.
```

## Article Without Title

```bash
bun src/index.ts --config dev-config.yaml post create \
  --slug no-title-article \
  --content "Article needs a title"
```

**Expected:**

```
❌ Articles require a title. Use --title option.
```

## Invalid Slug Format

```bash
bun src/index.ts --config dev-config.yaml post create \
  --title "Bad Slug" \
  --slug "Invalid Slug With Spaces" \
  --content "This should fail"
```

**Expected:** Error about invalid slug format (from API).

## Duplicate Slug

```bash
# Create first post
bun src/index.ts --config dev-config.yaml post create \
  --title "First" \
  --slug duplicate-test \
  --content "First post"

# Try to create with same slug
bun src/index.ts --config dev-config.yaml post create \
  --title "Second" \
  --slug duplicate-test \
  --content "Should fail"
```

**Expected:** First succeeds, second fails with "Slug already exists".

**Cleanup:**

```bash
bun src/index.ts --config dev-config.yaml post delete duplicate-test --force
```
