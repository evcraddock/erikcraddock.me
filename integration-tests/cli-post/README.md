# CLI Post Integration Tests

Manual integration tests for the `ec post` CLI commands.

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

- [create-basic.md](create-basic.md) - Create a basic article
- [create-with-options.md](create-with-options.md) - Create with tags and excerpt
- [create-errors.md](create-errors.md) - Error cases for create
- [list.md](list.md) - List posts with filters
- [show.md](show.md) - Show post details
- [edit.md](edit.md) - Edit post fields
- [publish.md](publish.md) - Publish and unpublish
- [delete.md](delete.md) - Delete with confirmation
