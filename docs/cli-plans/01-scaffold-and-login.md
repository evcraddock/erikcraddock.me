# Plan 01: CLI Scaffold and Login

## Goal

Set up CLI project structure and implement login flow. User can authenticate and store API key.

## Deliverables

- [ ] CLI project scaffold in `cli/` directory
- [ ] `ec login` command opens browser, prompts for key, stores it
- [ ] `ec config show` displays current configuration
- [ ] `ec version` displays CLI version
- [ ] Web UI `/cli/auth` page for authentication and key generation
- [ ] Global flags: `--verbose`, `--api-url`, `--api-key`

## Implementation

### 1. CLI Project Setup

```
cli/
├── src/
│   ├── index.ts          # entry point, command routing
│   ├── commands/
│   │   ├── login.ts
│   │   ├── config.ts
│   │   └── version.ts
│   ├── lib/
│   │   ├── config.ts     # read/write ~/.config/ec/config.yaml
│   │   ├── api.ts        # API client
│   │   └── output.ts     # table/json formatting
│   └── types.ts
├── package.json
└── tsconfig.json
```

### 2. Commands

**`ec login`**

1. Print "Opening browser..."
2. Open `{api_url}/cli/auth` in default browser (use `open` / `xdg-open`)
3. Prompt: "Paste API key:"
4. Verify key via `GET /api/ping`
5. Store in config file
6. Print success message

**`ec config show`**

- Display api_url and api_key (masked) from config

**`ec version`**

- Print version from package.json

### 3. Web UI: `/cli/auth`

New route in `src/routes/auth.tsx`:

1. If not authenticated → show login form (magic email or passkey)
2. After auth → generate API key with name "CLI - {date}"
3. Display key with:
   - Large monospace text
   - Copy button
   - Instructions: "Paste this into your terminal"
   - Warning: "This won't be shown again"

### 4. Config File

Location: `~/.config/ec/config.yaml`

```yaml
api_url: https://erikcraddock.me/api
api_key: ec_abc123...
```

## Testing

1. Run `ec login` → browser opens to `/cli/auth`
2. Log in via magic email
3. Copy displayed API key
4. Paste into CLI prompt
5. Run `ec config show` → shows stored config
6. Run `ec version` → shows version

## Dependencies

- None (first slice)

## API Changes

- None (uses existing `/api/ping`)
