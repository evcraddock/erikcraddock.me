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

## Task Lifecycle

- **Starting**: ALWAYS run `task-start-preflight` skill first
- **Closing**: Run `task-close-preflight` skill

## PR Workflow

1. Create feature branch: `feat/<task-id>-<description>`
2. Run `./scripts/pre-pr.sh` before opening PR
3. **Check logs for errors** before opening PR (see below)
4. After PR is created, use the `request-review` skill to spawn a separate agent to review the PR

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

## Conventions

- Use TypeScript strict mode
- Prefer named exports over default exports
- Use path aliases for imports (@/...)
- Handle null explicitly with ?? and ?.
- Write tests with Vitest
