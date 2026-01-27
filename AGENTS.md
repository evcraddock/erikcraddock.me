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

**ALWAYS start the dev server using `make dev`** - this runs all services (app, database, etc.) via the Makefile.

Key Makefile targets:

- `make dev` - Start development server (REQUIRED)
- `make test` - Run tests
- `make lint` - Run linter
- `make fmt` - Format code

Read the Makefile to understand available commands before starting work.

## Task Lifecycle

- **Starting**: ALWAYS run `task-start-preflight` skill first
- **Closing**: Run `task-close-preflight` skill

## PR Workflow

1. Create feature branch: `feat/<task-id>-<description>`
2. Run `./scripts/pre-pr.sh` before opening PR
3. After PR is created, use the `request-review` skill to spawn a separate agent to review the PR

## Conventions

- Use TypeScript strict mode
- Prefer named exports over default exports
- Use path aliases for imports (@/...)
- Handle null explicitly with ?? and ?.
- Write tests with Vitest
