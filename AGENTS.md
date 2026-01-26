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

Personal website and blog that also acts as an activitypub actor

## Tech Stack

- Language: TypeScript
- Framework: Hono

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
- Write tests with Vitest or Jest
