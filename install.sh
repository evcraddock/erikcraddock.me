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
echo "Fetching latest CLI release..."
LATEST=$(curl -fsSL "https://api.github.com/repos/$REPO/releases" | \
    grep '"tag_name":' | \
    grep 'cli-v' | \
    head -1 | \
    sed -E 's/.*"(cli-v[^"]+)".*/\1/')

if [ -z "$LATEST" ]; then
    echo "Error: No CLI releases found."
    echo "Check https://github.com/$REPO/releases for available releases."
    exit 1
fi

echo "Installing EC CLI $LATEST for $TARGET..."

# Download and extract
URL="https://github.com/$REPO/releases/download/$LATEST/ec-$TARGET.tar.gz"
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "Downloading from $URL..."
if ! curl -fsSL "$URL" -o "$TEMP_DIR/ec.tar.gz"; then
    echo "Error: Failed to download release."
    echo "URL: $URL"
    exit 1
fi

tar -xzf "$TEMP_DIR/ec.tar.gz" -C "$TEMP_DIR"

# Install
mkdir -p "$INSTALL_DIR"
mv "$TEMP_DIR/ec" "$INSTALL_DIR/$BINARY_NAME"
chmod +x "$INSTALL_DIR/$BINARY_NAME"

echo ""
echo "✅ Installed $BINARY_NAME to $INSTALL_DIR/$BINARY_NAME"

# Check if in PATH
if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
    echo ""
    echo "⚠️  $INSTALL_DIR is not in your PATH."
    echo "   Add it with:"
    echo ""
    echo "   export PATH=\"$INSTALL_DIR:\$PATH\""
    echo ""
    echo "   Or add to your shell profile (~/.bashrc, ~/.zshrc, etc.)"
fi

echo ""
echo "Run '$BINARY_NAME version' to verify installation."
echo "Run '$BINARY_NAME login' to get started."
