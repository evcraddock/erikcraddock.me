# CLI Tag Integration Tests

Manual integration tests for the `ec tag` CLI commands.

## Prerequisites

1. Dev environment running: `make dev`
2. CLI configured with API key (see `cli-auth` skill)

### Verify setup

```bash
make dev-status
cd cli && bun run src/index.ts config show
```

## Tests

- [list.md](list.md) - List tags with counts
