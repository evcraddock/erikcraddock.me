#!/bin/bash
#
# Seed the dev database with example content.
# Requires: dev server running (make dev) and cli/dev-config.yaml configured.
#

set -e

cd "$(dirname "$0")/.."

EC="bun cli/src/index.ts --config cli/dev-config.yaml"

echo "Creating articles..."
for f in examples/articles/*.md; do
  slug=$(basename "$f" .md)
  echo "  $slug"
  $EC post create --file "$f" 2>/dev/null || true
done

echo ""
echo "Creating links..."
for f in examples/links/*.md; do
  slug=$(basename "$f" .md)
  echo "  $slug"
  $EC post create --file "$f" 2>/dev/null || true
done

echo ""
echo "Creating notes..."
for f in examples/notes/*.md; do
  slug=$(basename "$f" .md)
  echo "  $slug"
  $EC post create --file "$f" 2>/dev/null || true
done

echo ""
echo "Publishing all posts..."
for f in examples/articles/*.md examples/links/*.md examples/notes/*.md; do
  slug=$(basename "$f" .md)
  $EC post publish "$slug" 2>/dev/null || true
done

echo ""
echo "Done."
