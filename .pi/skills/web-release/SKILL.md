---
name: web-release
description: Create a new web release tag based on conventional commits. Use when user says "web release", "release web", "deploy", "new web version", "release the site", or similar.
---

# Web Release

Create a new web release tag (`web-v*`) based on conventional commits since the last release.

## Quick Reference

```bash
# The script handles: version bump, commit, tag, push
# Path: ./scripts/release.sh (relative to this skill directory)
./scripts/release.sh patch   # Bug fixes
./scripts/release.sh minor   # New features
./scripts/release.sh major   # Breaking changes
./scripts/release.sh 1.2.3   # Explicit version
```

## Instructions

### 1. Verify on main branch

```bash
git branch --show-current
git fetch origin main
git log origin/main..HEAD --oneline
```

- Must be on `main`
- No unpushed commits (if any exist, stop and tell user to push or create PR)

### 2. Get changes since last release

```bash
LATEST_TAG=$(git tag --list 'web-v*' --sort=-v:refname | head -1)
git log ${LATEST_TAG}..HEAD --oneline
```

If no commits since last tag, inform user and stop.

### 3. Analyze commits for version bump

**MAJOR** (breaking): `BREAKING CHANGE:` in message, or `feat!:`, `fix!:`
**MINOR** (feature): `feat:` prefix
**PATCH** (fix): `fix:`, `perf:` prefix

Other types (docs, style, refactor, test, chore, ci, build) don't bump alone.

Priority: MAJOR > MINOR > PATCH. Default to PATCH if unclear.

### 4. Present options to user

Show:

- Current version
- Commits since last release (grouped by type)
- Recommended bump and why

Ask user to choose:

- Recommended version (e.g., "1.2.4 - Patch (Recommended)")
- Alternative bumps if applicable
- Cancel

### 5. Run the release script

Once user chooses, run `./scripts/release.sh` from this skill's directory:

```bash
.pi/skills/web-release/scripts/release.sh <patch|minor|major>
```

The script handles:

1. Validates on main with no unpushed commits
2. Updates package.json
3. Commits the version bump
4. Creates annotated tag
5. Pushes commit and tag

### 6. Confirm success

After the script completes, note that GitHub Actions will:

- Build Docker image for amd64 and arm64
- Push to `evcraddock/erikcraddock-web` on Docker Hub
- Tag with semver, timestamp, and `latest`

## Important Notes

- NEVER force push or use `--force` flags
- The script creates annotated tags automatically
- If script fails, read the error and do not retry blindly
