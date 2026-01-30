# CLI Source Integration Tests

Manual integration tests for the `ec source` CLI commands.

## Prerequisites

1. Dev environment running: `make dev`
2. CLI configured with API key (see `cli-auth` skill)

### Verify setup

```bash
make dev-status
cd cli && bun run src/index.ts config show
```

## Tests

- [list.md](list.md) - List sources
- [show.md](show.md) - Show source details
- [create.md](create.md) - Create a source
- [edit.md](edit.md) - Edit source fields
- [delete.md](delete.md) - Delete with confirmation
