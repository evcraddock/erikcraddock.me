# CLI Source Integration Tests

Manual integration tests for the `ec source` CLI commands.

## Prerequisites

1. Dev environment running: `make dev`
2. CLI dev config set up:
   ```bash
   cp cli/dev-config.yaml.example cli/dev-config.yaml
   # Then login to get API key:
   cd cli && bun src/index.ts --config dev-config.yaml login --api-url http://localhost:5000/api
   ```

### Verify setup

```bash
make dev-status
cd cli && bun src/index.ts --config dev-config.yaml config show
```

## Tests

- [list.md](list.md) - List sources
- [show.md](show.md) - Show source details
- [create.md](create.md) - Create a source
- [edit.md](edit.md) - Edit source fields
- [delete.md](delete.md) - Delete with confirmation
