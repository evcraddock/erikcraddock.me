# Contributing

This project uses an AI-first development process. Agents do the work, automation enforces quality, humans approve.

## Workflow

### Pipeline Communication

At each handoff or meaningful state change, state where the work is in the task pipeline and what you expect from the human.

Use a short status block like:

```text
Pipeline: Preflight complete → awaiting plan approval
Expected from you: approve the plan, request changes, or stop the task.
```

Include this when:

- preflight finishes
- a plan is ready for approval
- implementation starts
- work is ready for visual review
- a PR is opened or CI status changes
- review feedback is ready to address
- merge/close approval is needed
- the task is blocked

Be explicit about the next human action. Examples:

- "Approve this plan before I start coding."
- "Review the screenshot and tell me whether to keep this direction."
- "CI passed; tell me when to request review or merge."
- "Human approval is required before merging."

When waiting for CI, use code or a tool-driven command to check status on an interval. Do not say you are waiting unless you actually run a wait/check loop. Example:

```bash
while true; do
  gh pr view <number> --json statusCheckRollup --jq '.statusCheckRollup[]? | "\(.name): \(.status) \(.conclusion // "")"'
  if gh pr view <number> --json statusCheckRollup --jq '(.statusCheckRollup | length) > 0 and all(.statusCheckRollup[]; .status == "COMPLETED")' | grep -q true; then
    break
  fi
  sleep 30
done
```

### 1. Pick Up a Task

Get assigned a task or pick from available tasks. Understand requirements before starting.

### 2. Create a Branch

```bash
git checkout main && git pull
git checkout -b feat/{task-id}-short-description
```

Branch prefixes:

- `feat/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation only
- `chore/` - Maintenance

### 3. Implement

- Follow [CODE_STANDARDS.md](CODE_STANDARDS.md)
- Write tests as you go
- Commit frequently with clear messages

Commit format:

```
<type>: <short description>

Task: #<task-id>
```

Quality checks run automatically:

- **Pre-commit**: Formats and lints staged files
- **Pre-push**: Runs full lint, typecheck, and tests

You cannot push code that fails these checks.

### 4. Open PR

Push and create PR with clear description linking to the task.

### 5. Review and Merge

- CI must pass
- Address review feedback
- Squash and merge after approval

## When Stuck

After 3 failed attempts at the same problem:

1. Stop - Don't keep trying the same approach
2. Document - What was tried and why it failed
3. Ask - Request guidance or suggest alternatives
