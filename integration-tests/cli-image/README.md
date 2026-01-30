# CLI Image Integration Tests

Manual integration tests for the `ec image` CLI commands.

## Prerequisites

1. Dev environment running: `make dev`
2. CLI configured with API key (see `cli-auth` skill)
3. A test image file available (e.g., `test.jpg`)

### Verify setup

```bash
make dev-status
cd cli && bun run src/index.ts config show
```

### Create test image (if needed)

```bash
# Create a simple test image using ImageMagick
convert -size 100x100 xc:red /tmp/test.jpg
```

## Tests

- [upload.md](upload.md) - Upload images with various options
- [delete.md](delete.md) - Delete images with confirmation
