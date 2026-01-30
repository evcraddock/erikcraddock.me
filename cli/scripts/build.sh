#!/bin/bash
# Build EC CLI binaries for distribution
set -e

cd "$(dirname "$0")/.."

VERSION=$(jq -r '.version' package.json)
TARGETS=("linux-x64" "darwin-x64" "darwin-arm64")

echo "Building EC CLI v$VERSION"
echo ""

mkdir -p dist

for target in "${TARGETS[@]}"; do
  echo "Building for $target..."
  bun build ./src/index.ts \
    --compile \
    --target=bun-$target \
    --outfile=dist/ec-$target
done

echo ""
echo "Creating archives..."

cd dist
for target in "${TARGETS[@]}"; do
  # Extract just the binary name for the archive
  tar -czvf ec-$target.tar.gz ec-$target
done

echo ""
echo "Built EC CLI v$VERSION:"
ls -lh *.tar.gz
