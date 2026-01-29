---
name: cli-auth
description: Configure the CLI with an API key. Use when needing to authenticate the CLI for integration tests or manual testing.
---

# CLI Auth

Configure the CLI with an API key from the dev environment.

## Prerequisites

- Dev server running (`make dev`)
- `ADMIN_EMAIL` set in `.env`

## Manual Flow

```bash
cd cli
bun run src/index.ts login
```

Follow the prompts - enter API URL, login in browser, paste the key.

## Automated Flow (Agent)

### 1. Start CLI Login

```bash
cd cli
bun run src/index.ts login --api-url http://localhost:5000/api
```

This opens browser to `http://localhost:5000/cli/auth` with the login form.

### 2. Complete Login (web-login skill)

Use the **web-login** skill to:

- Fill email and submit
- Get magic link from logs
- Navigate to magic link

After login, browser redirects back to `/cli/auth` showing the API key.

### 3. Extract API Key

```bash
API_KEY=$(~/.local/share/pi-skills/browser-tools/browser-eval.js "document.querySelector('code')?.textContent")
echo "API Key: $API_KEY"
```

### 4. Provide Key to CLI

The `ec login` command is waiting for the API key. Paste it into the terminal, or if running non-interactively, write the config directly:

```bash
mkdir -p ~/.config/ec
cat > ~/.config/ec/config.yaml << EOF
api_url: http://localhost:5000/api
api_key: $API_KEY
EOF
```

### 5. Verify

```bash
cd cli && bun run src/index.ts config show
cd cli && bun run src/index.ts post list
```
