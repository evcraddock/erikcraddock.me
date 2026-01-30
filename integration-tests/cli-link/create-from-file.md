# Test: Create Link from File

Create a link from a markdown file with frontmatter.

## Setup

Create a test markdown file:

```bash
cat > /tmp/test-link.md << 'EOF'
---
url: https://news.ycombinator.com/item?id=12345
slug: hn-discussion
title: Great HN Discussion
tags: [tech, discussion]
excerpt: Interesting points about software architecture
---

Really enjoyed this discussion. Key takeaways:

1. Keep things simple
2. Composition over inheritance
3. Write tests first

Worth a read if you're into software design.
EOF
```

## Command

```bash
cd cli
bun src/index.ts --config dev-config.yaml link create --file /tmp/test-link.md
```

## Expected Output

```
✅ Link created: hn-discussion
   URL: https://news.ycombinator.com/item?id=12345
   Title: Great HN Discussion
   Status: draft
   Tags: Tech, Discussion
   Source: /tmp/test-link.md
```

## Verify

```bash
bun src/index.ts --config dev-config.yaml link show hn-discussion
```

**Expected:** Shows URL, title, tags, and content from the file.

## Pull and Verify Roundtrip

```bash
bun src/index.ts --config dev-config.yaml link pull hn-discussion -o /tmp/pulled-link.md
cat /tmp/pulled-link.md
```

**Expected:** Frontmatter includes `url:`, `type: link`, tags, etc.

## Cleanup

```bash
bun src/index.ts --config dev-config.yaml link delete hn-discussion --force
rm /tmp/test-link.md /tmp/pulled-link.md
```
