# Plan 07: Release Infrastructure

## Goal

Set up build, release workflow, and install script. Users can install CLI via curl.

## Deliverables

- [ ] Build script compiles standalone binaries with Bun
- [ ] GitHub Actions workflow for releases
- [ ] `install.sh` script for easy installation
- [ ] `ec version` shows embedded version

## Implementation

### 1. Build Script

**`cli/scripts/build.sh`**

```bash
#!/bin/bash
set -e

VERSION=$(jq -r '.version' package.json)
TARGETS=("linux-x64" "darwin-x64" "darwin-arm64")

mkdir -p dist

for target in "${TARGETS[@]}"; do
  echo "Building for $target..."
  bun build ./src/index.ts \
    --compile \
    --target=bun-$target \
    --outfile=dist/ec-$target
done

# Create archives
cd dist
for target in "${TARGETS[@]}"; do
  tar -czvf ec-$target.tar.gz ec-$target
done

echo "Built version $VERSION"
```

### 2. Version Embedding

In `cli/src/commands/version.ts`:

```typescript
// Version is read from package.json at build time
import pkg from "../../package.json";

export function version() {
  console.log(`ec ${pkg.version}`);
}
```

Bun embeds JSON imports at compile time.

### 3. GitHub Actions Workflow

**`.github/workflows/cli-release.yml`**

```yaml
name: CLI Release

on:
  push:
    tags:
      - "cli-v*"

permissions:
  contents: write

jobs:
  build:
    name: Build (${{ matrix.target }})
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        include:
          - target: linux-x64
            os: ubuntu-latest
          - target: darwin-x64
            os: macos-latest
          - target: darwin-arm64
            os: macos-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: cd cli && bun install

      - name: Run tests
        run: cd cli && bun test

      - name: Build binary
        run: |
          cd cli
          bun build ./src/index.ts \
            --compile \
            --target=bun-${{ matrix.target }} \
            --outfile=ec

      - name: Package binary
        run: |
          cd cli
          tar -czvf ec-${{ matrix.target }}.tar.gz ec

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: ec-${{ matrix.target }}
          path: cli/ec-${{ matrix.target }}.tar.gz

  release:
    name: Create Release
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: artifacts

      - name: Create release
        uses: softprops/action-gh-release@v1
        with:
          files: artifacts/**/*.tar.gz
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 4. Install Script

**`install.sh`** (repo root)

```bash
#!/bin/bash
# EC CLI installer
# Usage: curl -fsSL https://raw.githubusercontent.com/evcraddock/erikcraddock.me/main/install.sh | bash

set -e

REPO="evcraddock/erikcraddock.me"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
BINARY_NAME="ec"

# Detect OS and architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$OS" in
    linux)
        case "$ARCH" in
            x86_64) TARGET="linux-x64" ;;
            *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
        esac
        ;;
    darwin)
        case "$ARCH" in
            x86_64) TARGET="darwin-x64" ;;
            arm64) TARGET="darwin-arm64" ;;
            *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
        esac
        ;;
    *)
        echo "Unsupported OS: $OS"
        exit 1
        ;;
esac

# Get latest CLI release version (filter for cli-v* tags)
echo "Fetching latest release..."
LATEST=$(curl -fsSL "https://api.github.com/repos/$REPO/releases" | \
    grep '"tag_name":' | \
    grep 'cli-v' | \
    head -1 | \
    sed -E 's/.*"(cli-v[^"]+)".*/\1/')

if [ -z "$LATEST" ]; then
    echo "Failed to fetch latest CLI release"
    exit 1
fi

echo "Installing EC CLI $LATEST for $TARGET..."

# Download and extract
URL="https://github.com/$REPO/releases/download/$LATEST/ec-$TARGET.tar.gz"
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

curl -fsSL "$URL" -o "$TEMP_DIR/ec.tar.gz"
tar -xzf "$TEMP_DIR/ec.tar.gz" -C "$TEMP_DIR"

# Install
mkdir -p "$INSTALL_DIR"
mv "$TEMP_DIR/ec" "$INSTALL_DIR/$BINARY_NAME"
chmod +x "$INSTALL_DIR/$BINARY_NAME"

echo ""
echo "✓ Installed $BINARY_NAME to $INSTALL_DIR/$BINARY_NAME"

# Check if in PATH
if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
    echo ""
    echo "Note: $INSTALL_DIR is not in your PATH."
    echo "Add it with:"
    echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
fi

echo ""
echo "Run '$BINARY_NAME login' to get started."
```

### 5. Release Process

Document in CLI_DESIGN.md or CONTRIBUTING.md:

```bash
# 1. Update version in cli/package.json
cd cli
npm version patch  # or minor, major

# 2. Commit
git add cli/package.json
git commit -m "chore(cli): bump version to 0.2.0"

# 3. Tag and push
git tag cli-v0.2.0
git push origin main cli-v0.2.0

# 4. GitHub Actions builds and creates release automatically
```

## Testing

1. Run build script locally → creates binaries in `dist/`
2. Run `./dist/ec-linux-x64 version` → shows version
3. Push `cli-v0.1.0` tag → GitHub Actions runs
4. Check GitHub releases → binaries attached
5. Run install script → downloads and installs
6. Run `ec version` → shows installed version

## Dependencies

- Plan 01 (CLI scaffold, version command)

## Files Created

| File                                | Purpose            |
| ----------------------------------- | ------------------ |
| `cli/scripts/build.sh`              | Local build script |
| `.github/workflows/cli-release.yml` | Release automation |
| `install.sh`                        | User installation  |
