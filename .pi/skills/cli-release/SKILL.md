---
name: cli-release
description: Create a new CLI release tag. Use when user says "cli release", "release cli", "new cli version", "release the cli", or similar.
---

# CLI Release

Create a new CLI release tag (`cli-v*`) based on conventional commits since the last release.

## Quick Reference

```bash
# The script handles: version bump, commit, tag, push, verify
# Path: ./scripts/release.sh (relative to this skill directory)
.pi/skills/cli-release/scripts/release.sh patch   # Bug fixes
.pi/skills/cli-release/scripts/release.sh minor   # New features
.pi/skills/cli-release/scripts/release.sh major   # Breaking changes
.pi/skills/cli-release/scripts/release.sh 1.2.3   # Explicit version
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
LATEST_TAG=$(git tag --list 'cli-v*' --sort=-v:refname | head -1)
git log ${LATEST_TAG}..HEAD --oneline -- cli/
```

Look at commits that touch the `cli/` directory.

If no CLI commits since last tag, inform user and stop.

### 3. Analyze commits for version bump

**MAJOR** (breaking): `BREAKING CHANGE:` in message, or `feat!:`, `fix!:`
**MINOR** (feature): `feat:` prefix
**PATCH** (fix): `fix:`, `perf:` prefix

Other types (docs, style, refactor, test, chore, ci, build) don't bump alone.

Priority: MAJOR > MINOR > PATCH. Default to PATCH if unclear.

### 4. Present options to user

Show:

- Current version
- CLI commits since last release
- Recommended bump and why

Ask user to choose:

- Recommended version (e.g., "0.5.0 - Minor (Recommended)")
- Alternative bumps if applicable
- Cancel

### 5. Run the release script

Once user chooses, run `./scripts/release.sh` from this skill's directory:

```bash
.pi/skills/cli-release/scripts/release.sh <patch|minor|major>
```

The script handles:

1. Validates on main with no unpushed commits
2. Updates cli/package.json
3. Commits the version bump
4. Creates annotated tag
5. Pushes commit and tag
6. **Verifies tag exists on remote** (fixes silent push failures)

### 6. Confirm success

After the script completes, note that GitHub Actions will:

- Build CLI binaries for linux-x64, darwin-x64, darwin-arm64
- Create GitHub release with binaries
- Update install script availability

## Important Notes

- NEVER force push or use `--force` flags
- The script creates annotated tags automatically
- The script **verifies** the tag was pushed (checks remote)
- If script fails, read the error and do not retry blindly
- CLI version lives in `cli/package.json`, not root package.json
