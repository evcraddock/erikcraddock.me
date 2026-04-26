# Link Attribution Backfill

This one-time process backfills `source_id` and direct `author_id` for link posts that existed before source and link-author attribution were added.

The process is intentionally staged:

1. Run discovery to produce a reviewable plan.
2. Review and edit the plan if needed.
3. Apply the reviewed plan.
4. Verify with `ec` and spot-check public pages.

Do not edit the production database directly. The script uses `ec` for production reads and writes.

## Discovery

Discovery is the default and does not mutate data.

```bash
bun scripts/backfill-link-attribution.ts discover --plan tmp/link-attribution-plan.json
```

For local development, pass the dev CLI config:

```bash
bun scripts/backfill-link-attribution.ts discover --config cli/dev-config.yaml --plan tmp/link-attribution-plan.json
```

Useful options:

```bash
--limit N     # inspect at most N links
--offset N    # skip the first N links, useful for 10-link batches
--no-fetch    # skip external page fetches and rely on stored metadata/title/site rules
```

For 10-link batches:

```bash
bun scripts/backfill-link-attribution.ts discover --limit 10 --offset 0 --plan tmp/link-attribution-plan-001.json
bun scripts/backfill-link-attribution.ts discover --limit 10 --offset 10 --plan tmp/link-attribution-plan-002.json
```

Discovery calls:

- `ec link list --json`
- `ec link show <slug> --json`
- `ec source list --json`
- `ec person list --json`

The plan groups links by normalized hostname and proposes sources using existing sources, stored link metadata, fetched metadata, and hostname fallback. When page fetching is enabled, discovery also proposes RSS/Atom feed URLs from `<link rel="alternate">` metadata. Direct authors are proposed only when confidence is high, such as JSON-LD author metadata, `<meta name="author">`, title byline patterns, or explicit known-site rules.

Ambiguous or missing authors are listed separately and are not auto-applied.

## Review

Review `tmp/link-attribution-plan.json` before applying.

For each group, check:

- `siteKey`
- `proposedSource.name`
- `proposedSource.url`
- `existingSourceId`
- each link `action`
- author `confidence` and `evidence`

By default, existing non-null `source_id` and `author_id` are not overwritten.

## Apply

Apply requires an explicit `apply` mode and a reviewed plan path.

```bash
bun scripts/backfill-link-attribution.ts apply --plan tmp/link-attribution-plan.json --result tmp/link-attribution-results.json
```

For local development:

```bash
bun scripts/backfill-link-attribution.ts apply --config cli/dev-config.yaml --plan tmp/link-attribution-plan.json --result tmp/link-attribution-results.json
```

Apply mode uses:

- `ec source create` for missing sources
- `ec source edit --feed-url ...` for discovered feeds on existing sources without feed URLs
- `ec person create` for missing people
- `ec link edit --source ... --author ...` for link updates

It writes a result file with created sources, updated sources, created people, successes, skips, and failures.

## Verification

After applying a reviewed plan, verify with:

```bash
ec source list --json
ec link list --json
```

Spot-check public pages for updated links and confirm they render:

- `by <author>` when `author_id` is set
- `via <source>` when `source_id` is set

## Safety notes

- Discovery is read-only.
- Apply is explicit.
- The script does not directly access production SQLite.
- Existing non-null `source_id` and `author_id` are not overwritten by default.
- Page fetches are rate-limited.
- Do not commit production plan/result dumps unless sanitized.
