# AI Agent Guidelines for erikcraddock.me

## Before Starting ANY Task

**ALWAYS use the `task-start-preflight` skill** when you hear:

- "start task", "work on task", "get started", "pick up task"
- "let's do task", "begin task", "tackle task"
- Or any variation of starting work

The preflight ensures you understand the task, check dependencies, and follow project guidelines.

## Required Reading

Before working, read and follow:

- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) - workflow and PR process
- [docs/CODE_STANDARDS.md](docs/CODE_STANDARDS.md) - code style and patterns

You MUST follow these guidelines throughout your work.

## NEVER Push Directly to Main

**No exceptions. No "quick fixes". No "obvious bugs".**

Always:

1. Create a feature branch (`feat/<task-id>-<description>`)
2. Create a PR
3. Wait for explicit human approval ("merge", "approved", "LGTM")
4. Only then merge

This applies even when:

- You're confident the fix is correct
- It's a one-line change
- You're in the middle of debugging
- The user seems to want it done quickly

**The process exists because the human needs to review and approve changes before they ship.** Pushing directly to main takes that decision away from them. It's irreversible.

If you push directly to main, you have violated the user's trust.

## Project Overview

Personal website and blog that can be followed from Mastodon. Publishes articles, linkblogs, and notes that federate to followers via ActivityPub.

## Development Approach: Vertical Slices

Build features as **vertical slices**, not horizontal layers. Each task should deliver visible, working progress.

**❌ Don't do this (layers):**

1. Build all database schema
2. Build all backend routes
3. Build all API endpoints
4. Then finally UI you can see

**✅ Do this (slices):**

1. Home page renders with layout → visible
2. Posts display from DB → visible
3. Single post page works → visible
4. API creates posts, see them on site → visible

Each task should result in something a human can see or interact with, even if rough. No long stretches of "invisible" backend-only work.

**Keep PRs small.** Humans review every PR. Break work into small units:

- Aim for PRs under 300 lines changed
- One logical change per PR
- If a feature is big, split it into multiple PRs that build on each other
- It's better to merge 3 small PRs than 1 large one

## Visual Verification

When testing UI changes, **open a browser** instead of using curl. Humans need to see the result, not just verify HTML was returned.

Use the `browser-tools` skill to open pages and take screenshots when verifying:

- Page layouts and styling
- Form interactions
- Any user-facing changes

## Tech Stack

- **Language**: TypeScript (strict mode)
- **Framework**: Hono
- **ActivityPub**: Fedify
- **Database**: Drizzle ORM + SQLite
- **Templates**: Hono JSX
- **Styles**: Tailwind CSS
- **Storage**: S3-compatible (Garage)

## Database Changes

**NEVER use `drizzle-kit push`** - it bypasses migrations and causes drift.

### Schema Change Workflow

1. Modify schema in `src/db/schema.ts`
2. Generate migration: `make db-generate`
3. Review the generated SQL in `drizzle/`
4. Commit both the schema change AND the migration file
5. Migrations run automatically on app startup

### Rules

- **NEVER access the database directly using SQL commands** (sqlite3, SQL queries, etc.)
  - Use the `ec` CLI for creating/managing content
  - Use `make db-studio` for browsing data (Drizzle Studio)
  - Use the application's API endpoints for data operations
- Every schema change MUST have a corresponding migration file
- Migration files are immutable once committed - never edit them
- The `drizzle/` folder must be committed to git
- Pre-push hook and CI will fail if migrations are out of sync

### Commands

```bash
make db-generate   # Generate migration from schema changes
make db-studio     # Browse database with Drizzle Studio
```

## Development

**ALWAYS start the dev server using `make dev`** - this runs all services via overmind.

### Makefile Commands

Run `make help` to see all commands. Key targets:

**Development:**

- `make dev` - Start dev environment (daemonized)
- `make dev-stop` - Stop dev environment
- `make dev-restart` - Restart dev environment
- `make dev-status` - Show process status (running PIDs)
- `make dev-logs` - Stream all logs (Ctrl+C to stop)
- `make dev-tail` - Show last 50 lines of logs (non-blocking)

**Connect to terminals** (Ctrl+b d to detach):

- `make connect-app` - Attach to app terminal
- `make connect-css` - Attach to CSS watcher terminal

**Quality:**

- `make check` - Run linting and tests
- `make pre-pr` - Run pre-PR checks

### Reading Logs

For quick log inspection without blocking:

```bash
make dev-tail      # Last 50 lines from each service
make dev-status    # Process status with PIDs
```

For streaming logs (blocks terminal):

```bash
make dev-logs      # Ctrl+C to stop
```

## CLI Development

The `ec` CLI is in the `cli/` directory. When running CLI commands against the local dev server, use the dev config file.

### Setup

```bash
# Copy the example config
cp cli/dev-config.yaml.example cli/dev-config.yaml

# Login to get an API key
bun cli/src/index.ts login --config cli/dev-config.yaml --api-url http://localhost:5000/api
```

### Running CLI Commands

Always use `--config cli/dev-config.yaml` when testing against the local dev server:

```bash
bun cli/src/index.ts --config cli/dev-config.yaml post list
bun cli/src/index.ts --config cli/dev-config.yaml post create --title "Test" --slug test
```

Or set the environment variable once per session:

```bash
export EC_CONFIG=cli/dev-config.yaml
bun cli/src/index.ts post list
```

### Integration Tests

CLI integration tests are in `integration-tests/cli-*/`. These tests assume `EC_CONFIG=cli/dev-config.yaml` is set or `--config cli/dev-config.yaml` is used.

## Task Lifecycle

- **Starting**: ALWAYS run `task-start-preflight` skill first
- **Closing**: Run `task-close-preflight` skill

## PR Workflow

1. Create feature branch: `feat/<task-id>-<description>`
2. Commit changes (pre-commit hook runs: format + lint staged files)
3. Push changes (pre-push hook runs: full lint, typecheck, tests)
4. **Check logs for errors** before opening PR (see below)
5. Create PR with `gh pr create`
6. **Wait for CI to pass** before requesting review (see below)
7. Use the `request-review` skill to spawn a separate agent to review the PR
8. **Wait for human approval before merging** (see below)

### NEVER Merge Without Human Approval

**Agent reviews do not replace human approval.** The agent review is a helper to catch issues early - it is NOT permission to merge.

After an agent review completes:

1. Show the review results to the user
2. **Stop and wait for explicit human approval**
3. Only merge when the user says "merge", "approved", "LGTM", or similar

**DO NOT:**

- Auto-merge after agent review
- Assume approval because the review passed
- Merge and then tell the user about it

**The human decides when to merge. Always.**

### Check Logs Before PR

Before creating a PR, verify there are no errors in the application logs:

```bash
make dev-tail 2>&1 | grep -E "(ERROR|WARN|error|Error)"
```

If errors are present:

- Fix them before opening the PR
- Don't ignore warnings without good reason
- If an error is expected/acceptable, document why in the PR description

This catches runtime issues that tests might miss (startup errors, middleware failures, etc.).

### Wait for CI Before Requesting Review

After creating a PR, CI runs automatically. **Do not request a review until CI passes.**

Check CI status:

```bash
gh pr view <number> --json statusCheckRollup --jq '.statusCheckRollup[0] | "\(.status) - \(.conclusion // "pending")"'
```

If CI is still running, wait and check again:

```bash
sleep 30 && gh pr view <number> --json statusCheckRollup
```

If CI fails:

- Check the failure: `gh run view <run-id> --log-failed`
- Fix the issue, commit, and push
- Wait for CI to pass before requesting review

**Why:** Requesting review on a failing PR wastes the reviewer's time. CI runs the same checks as pre-push, but catches environment differences and ensures reviewers see green checks.

## Testing Requirements

Write tests for code with logic. Don't write tests just to have tests.

**Do test:**

- Business logic and data transformations
- Functions with conditionals or branching
- API route handlers (integration tests)
- Complex components with state or computed values
- Edge cases and error handling

**Don't test:**

- Schema/type definitions — TypeScript validates these at compile time
- Pure presentation components — use visual verification instead
- Third-party library integration in isolation — test when used in real features
- Simple pass-through functions with no logic

**Why this policy:**

Tests should catch bugs and prevent regressions. Testing that "a schema export exists" or "a static HTML element renders" provides no value — TypeScript and visual inspection already verify these. Save testing effort for code where bugs can hide.

**Before closing a task:**

- [ ] Code with logic has corresponding tests
- [ ] `npm test` passes
- [ ] Visual verification done for UI changes

## DO NOT TOUCH - Critical Dependencies

**NEVER remove or replace `better-sqlite3`.**

The production Docker image runs on Node.js (not Bun) because Bun crashes on Raspberry Pi 4 ARM64. Node.js requires `better-sqlite3` for SQLite. There is NO alternative that works:

- `node:sqlite` - drizzle-orm doesn't support it
- `sql.js` - complex async initialization, not compatible
- Removing better-sqlite3 breaks production

If you even THINK about touching the SQLite dependencies, STOP and ask first.

## Conventions

- Use TypeScript strict mode
- Prefer named exports over default exports
- Use path aliases for imports (@/...)
- Handle null explicitly with ?? and ?.
- Write tests with Vitest

## Releasing

Use the `web-release` skill to create releases. It will:

1. Analyze commits since last release
2. Determine version bump (major/minor/patch) based on conventional commits
3. Create annotated git tag (`web-v*`)
4. Push tag to trigger deployment

**Trigger phrases:** "release", "deploy", "web release", "new version"

### What happens on release

Pushing a `web-v*` tag triggers the deploy workflow:

1. Builds Docker image for amd64 and arm64
2. Pushes to `evcraddock/erikcraddock-web` on Docker Hub
3. Tags with semver, timestamp, and `latest`

### Docker Image

```bash
# Pull latest
docker pull evcraddock/erikcraddock-web:latest

# Run (requires database volume and env vars)
docker run -d \
  -p 3000:3000 \
  -v /path/to/data:/app/data \
  -e ADMIN_EMAIL=you@example.com \
  -e DOMAIN=erikcraddock.me \
  evcraddock/erikcraddock-web:latest
```
