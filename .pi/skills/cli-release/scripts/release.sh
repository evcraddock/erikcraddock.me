#!/usr/bin/env bash
#
# Create a CLI release with proper version bumping and verification.
#
# Usage:
#   ./scripts/release.sh patch|minor|major
#   ./scripts/release.sh <version>  (e.g., 1.2.3)
#
# This script:
#   1. Validates we're on main with no unpushed commits
#   2. Calculates or validates the new version
#   3. Updates cli/package.json
#   4. Commits the version bump
#   5. Creates an annotated tag
#   6. Pushes commit and tag to origin
#   7. VERIFIES tag exists on remote (catches silent push failures)
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
  echo "  $0 patch    # 0.4.0 -> 0.4.1"
  echo "  $0 minor    # 0.4.0 -> 0.5.0"
  echo "  $0 major    # 0.4.0 -> 1.0.0"
  echo "  $0 0.5.0    # Explicit version"
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
LATEST_TAG=$(git tag --list 'cli-v*' --sort=-v:refname | head -1)
if [[ -z "$LATEST_TAG" ]]; then
  CURRENT_VERSION="0.0.0"
else
  CURRENT_VERSION="${LATEST_TAG#cli-v}"
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

NEW_TAG="cli-v$NEW_VERSION"

info "New version: $NEW_VERSION (tag: $NEW_TAG)"

# Check if tag already exists locally
if git tag --list | grep -q "^$NEW_TAG$"; then
  die "Tag $NEW_TAG already exists locally"
fi

# Check if tag already exists on remote
if git ls-remote --tags origin | grep -q "refs/tags/$NEW_TAG$"; then
  die "Tag $NEW_TAG already exists on remote"
fi

# Step 5: Update cli/package.json
if [[ ! -f cli/package.json ]]; then
  die "cli/package.json not found"
fi

CURRENT_PKG_VERSION=$(jq -r .version cli/package.json)
if [[ "$CURRENT_PKG_VERSION" != "$NEW_VERSION" ]]; then
  info "Updating cli/package.json: $CURRENT_PKG_VERSION -> $NEW_VERSION"
  jq --arg v "$NEW_VERSION" '.version = $v' cli/package.json > cli/package.json.tmp
  mv cli/package.json.tmp cli/package.json
else
  warn "cli/package.json already at $NEW_VERSION"
fi

# Step 6: Commit the version bump (if there are changes)
if ! git diff --quiet cli/package.json; then
  git add cli/package.json
  git commit -m "chore(cli): bump version to $NEW_VERSION"
  info "Committed version bump"
else
  warn "No changes to commit (cli/package.json unchanged)"
fi

# Step 7: Create annotated tag
git tag -a "$NEW_TAG" -m "CLI Release $NEW_TAG"
info "Created tag: $NEW_TAG"

# Step 8: Push commit and tag
info "Pushing to origin..."
git push origin main --follow-tags

# Step 9: VERIFY tag exists on remote
# This catches silent push failures (e.g., SSH timeout during pre-push hooks)
info "Verifying tag on remote..."
sleep 2  # Brief pause to allow remote to update

if ! git ls-remote --tags origin | grep -q "refs/tags/$NEW_TAG$"; then
  die "Tag $NEW_TAG was NOT pushed to remote!\n\nThis can happen if pre-push hooks timeout.\nManually push with: git push origin $NEW_TAG"
fi

info ""
info "✅ Released $NEW_TAG"
info "✅ Verified tag exists on remote"
info ""
info "GitHub Actions will now build CLI binaries and create a release."
