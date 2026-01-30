# Admin Integration Tests

Pass/fail tests for the /admin section of the site.

## Structure

- **auth/** - Magic link login, sessions, logout
- **dashboard/** - Admin dashboard display
- **api-keys/** - API key management
- **passkeys/** - Passkey registration and management
- **authors/** - Author management (admin-only)

## Prerequisites

- Dev server running (`make dev`)
- Browser open via browser-tools skill
- `ADMIN_EMAIL` set in `.env`
- Logged in as admin (use web-login skill)

## Skills

- **web-login**: Automated login via magic link (`.pi/skills/web-login/SKILL.md`)
- **browser-tools**: Browser automation

## Running Tests

1. Start with auth tests to establish a session
2. Run other test suites in any order
3. Each file is independent (assumes fresh login if needed)
