# Test: Edit Source

Test editing source fields.

## Setup

```bash
cd cli

# Create a test source
bun src/index.ts --config dev-config.yaml source create --name "Edit Test" --url "https://edit.example.com" --json
```

Note the ID from the output.

## Edit Name

```bash
bun src/index.ts --config dev-config.yaml source edit <id> --name "Updated Name"
```

**Expected:** Success message.

```bash
bun src/index.ts --config dev-config.yaml source show <id>
```

**Expected:** Name shows "Updated Name".

## Edit URL

```bash
bun src/index.ts --config dev-config.yaml source edit <id> --url "https://updated.example.com"
```

**Expected:** Success message.

## Add Feed URL

```bash
bun src/index.ts --config dev-config.yaml source edit <id> --feed-url "https://updated.example.com/feed"
```

**Expected:** Success message.

```bash
bun src/index.ts --config dev-config.yaml source show <id>
```

**Expected:** Feed URL shows the new value.

## Replace Authors

```bash
bun src/index.ts --config dev-config.yaml source edit <id> --author "Alice" --author "Bob"
```

**Expected:** Success message.

```bash
bun src/index.ts --config dev-config.yaml source show <id>
```

**Expected:** Authors show "Alice, Bob".

## Clear Authors

```bash
bun src/index.ts --config dev-config.yaml source edit <id> --no-authors
```

**Expected:** Success message.

```bash
bun src/index.ts --config dev-config.yaml source show <id>
```

**Expected:** Authors show "-".

## Remove Feed URL

```bash
bun src/index.ts --config dev-config.yaml source edit <id> --no-feed-url
```

**Expected:** Success message.

```bash
bun src/index.ts --config dev-config.yaml source show <id>
```

**Expected:** Feed URL shows "-".

## Edit with JSON Output

```bash
bun src/index.ts --config dev-config.yaml source edit <id> --name "JSON Edit" --json
```

**Expected:** JSON object with updated source.

## Error: No Updates Provided

```bash
bun src/index.ts --config dev-config.yaml source edit <id>
```

**Expected:** Error message about no update options provided.

## Error: Non-existent ID

```bash
bun src/index.ts --config dev-config.yaml source edit 99999 --name "Test"
```

**Expected:** Error message "Source not found".

## Cleanup

```bash
bun src/index.ts --config dev-config.yaml source delete <id> --force
```
