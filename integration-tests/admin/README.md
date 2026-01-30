# Admin Integration Tests

Manual integration tests for the `/admin` section of the site.

## Prerequisites

1. Dev environment running: `make dev`
2. Browser open via browser-tools skill
3. `ADMIN_EMAIL` set in `.env`

### Skills

- **web-login**: Automated login via magic link (`.pi/skills/web-login/SKILL.md`)
- **browser-tools**: Browser automation

### Verify setup

```bash
make dev-status
grep ADMIN_EMAIL .env
```

## Tests

- [auth.md](auth.md) - Magic link login, sessions, logout
- [dashboard.md](dashboard.md) - Dashboard display and navigation
- [api-keys.md](api-keys.md) - Create, list, revoke API keys
- [passkeys.md](passkeys.md) - Register, list, delete passkeys
- [authors.md](authors.md) - Add, list, remove authors (admin-only)
