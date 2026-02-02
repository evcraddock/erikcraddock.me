#!/bin/bash
#
# Seed the dev database with example articles.
# Requires: dev server running (make dev) and cli/dev-config.yaml configured.
#

set -e

cd "$(dirname "$0")/.."

EC="bun cli/src/index.ts --config cli/dev-config.yaml"

echo "Creating articles..."

for article in examples/articles/*.md; do
  slug=$(basename "$article" .md)
  echo "  $slug"
  $EC post create --file "$article" 2>/dev/null || true
done

echo ""
echo "Publishing articles..."

for article in examples/articles/*.md; do
  slug=$(basename "$article" .md)
  $EC post publish "$slug" 2>/dev/null || true
done

echo ""
echo "Done."
