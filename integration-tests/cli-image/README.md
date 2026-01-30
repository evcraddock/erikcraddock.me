# CLI Image Integration Tests

Manual integration tests for the `ec image` CLI commands.

## Prerequisites

1. Dev environment running: `make dev`
2. CLI dev config set up:
   ```bash
   cp cli/dev-config.yaml.example cli/dev-config.yaml
   # Then login to get API key:
   cd cli && bun src/index.ts --config dev-config.yaml login --api-url http://localhost:5000/api
   ```
3. A test image file available (e.g., `test.jpg`)

### Verify setup

```bash
make dev-status
cd cli && bun src/index.ts --config dev-config.yaml config show
```

### Create test image (if needed)

```bash
# Create a simple test image using ImageMagick
convert -size 100x100 xc:red /tmp/test.jpg
```

## Tests

- [upload.md](upload.md) - Upload images with various options
- [delete.md](delete.md) - Delete images with confirmation
