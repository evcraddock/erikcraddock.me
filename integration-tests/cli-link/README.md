# CLI Link Integration Tests

Manual integration tests for the `ec link` CLI commands.

## Prerequisites

1. Dev environment running: `make dev`
2. CLI configured with API key (see `cli-auth` skill)

### Verify setup

```bash
make dev-status
cd cli && bun run src/index.ts config show
```

## Tests

- [create-basic.md](create-basic.md) - Create a basic link
- [create-from-file.md](create-from-file.md) - Create from markdown file
- [create-errors.md](create-errors.md) - Error cases for create
- [list.md](list.md) - List links with filters
- [show.md](show.md) - Show link details
- [edit.md](edit.md) - Edit link fields
- [publish.md](publish.md) - Publish and unpublish
- [delete.md](delete.md) - Delete with confirmation
- [pull.md](pull.md) - Download link as markdown
