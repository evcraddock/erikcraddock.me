#!/usr/bin/env bash
#
# Create a web release with proper version bumping.
#
# Usage:
#   ./scripts/release.sh patch|minor|major
#   ./scripts/release.sh <version>  (e.g., 1.2.3)
#
# This script:
#   1. Validates we're on main with no unpushed commits
#   2. Calculates or validates the new version
#   3. Updates package.json
#   4. Commits the version bump
#   5. Creates an annotated tag
#   6. Pushes commit and tag to origin
#
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

die() {
  echo -e "${RED}Error: $1${NC}" >&2
  exit 1
}

info() {
  echo -e "${GREEN}$1${NC}"
}

warn() {
  echo -e "${YELLOW}$1${NC}"
}

# Validate arguments
if [[ $# -ne 1 ]]; then
  echo "Usage: $0 patch|minor|major|<version>"
  echo ""
  echo "Examples:"
  echo "  $0 patch    # 1.2.3 -> 1.2.4"
  echo "  $0 minor    # 1.2.3 -> 1.3.0"
  echo "  $0 major    # 1.2.3 -> 2.0.0"
  echo "  $0 1.5.0    # Explicit version"
  exit 1
fi

BUMP_ARG="$1"

# Step 1: Validate we're on main
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  die "Must be on main branch (currently on '$CURRENT_BRANCH')"
fi

# Step 2: Fetch and check for unpushed commits
git fetch origin main --quiet
UNPUSHED=$(git log origin/main..HEAD --oneline)
if [[ -n "$UNPUSHED" ]]; then
  die "Unpushed commits on main:\n$UNPUSHED\n\nPush these or create a PR first."
fi

# Step 3: Get current version from latest tag
LATEST_TAG=$(git tag --list 'web-v*' --sort=-v:refname | head -1)
if [[ -z "$LATEST_TAG" ]]; then
  CURRENT_VERSION="0.0.0"
else
  CURRENT_VERSION="${LATEST_TAG#web-v}"
fi

info "Current version: $CURRENT_VERSION"

# Parse current version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Step 4: Calculate new version
if [[ "$BUMP_ARG" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  # Explicit version provided
  NEW_VERSION="$BUMP_ARG"
elif [[ "$BUMP_ARG" == "patch" ]]; then
  NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))"
elif [[ "$BUMP_ARG" == "minor" ]]; then
  NEW_VERSION="$MAJOR.$((MINOR + 1)).0"
elif [[ "$BUMP_ARG" == "major" ]]; then
  NEW_VERSION="$((MAJOR + 1)).0.0"
else
  die "Invalid argument: $BUMP_ARG (expected patch|minor|major or X.Y.Z)"
fi

NEW_TAG="web-v$NEW_VERSION"

info "New version: $NEW_VERSION (tag: $NEW_TAG)"

# Check if tag already exists
if git tag --list | grep -q "^$NEW_TAG$"; then
  die "Tag $NEW_TAG already exists"
fi

# Step 5: Update package.json
CURRENT_PKG_VERSION=$(jq -r .version package.json)
if [[ "$CURRENT_PKG_VERSION" != "$NEW_VERSION" ]]; then
  info "Updating package.json: $CURRENT_PKG_VERSION -> $NEW_VERSION"
  jq --arg v "$NEW_VERSION" '.version = $v' package.json > package.json.tmp
  mv package.json.tmp package.json
else
  warn "package.json already at $NEW_VERSION"
fi

# Step 6: Commit the version bump (if there are changes)
if ! git diff --quiet package.json; then
  git add package.json
  git commit -m "chore: bump version to $NEW_VERSION"
  info "Committed version bump"
else
  warn "No changes to commit (package.json unchanged)"
fi

# Step 7: Create annotated tag
git tag -a "$NEW_TAG" -m "Release $NEW_TAG"
info "Created tag: $NEW_TAG"

# Step 8: Push commit and tag
info "Pushing to origin..."
git push origin main --follow-tags

info ""
info "✅ Released $NEW_TAG"
info ""
info "GitHub Actions will now build and push the Docker image."
