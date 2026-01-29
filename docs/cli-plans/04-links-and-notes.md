# Plan 04: Links and Notes Commands

## Goal

Implement CRUD commands for links (linkblog) and notes. Reuse patterns from post commands.

## Deliverables

- [ ] `ec link list/show/create/edit/delete/publish/unpublish`
- [ ] `ec link create --file` with link frontmatter
- [ ] `ec link pull <slug>`
- [ ] `ec note list/show/create/edit/delete/publish/unpublish`
- [ ] `ec note create --file` with note frontmatter
- [ ] `ec note pull <slug>`

## Implementation

### 1. Link Commands

**`ec link list`**

```bash
ec link list
ec link list --limit 10 --tag tech --status draft
```

**`ec link show <slug>`**

```
URL:       https://example.com/article
Title:     Interesting Article
Slug:      interesting-article
Source:    Hacker News
Status:    published
Tags:      tech

---
My commentary on this...
```

**`ec link create`**

```bash
ec link create --url "https://..." --slug interesting-link --content "Commentary"
ec link create --url "https://..." --slug interesting-link --content "..." --title "Optional Title" --source 1 --tags tech
ec link create --file link.md
```

**`ec link pull <slug>`**

```bash
ec link pull interesting-link
```

Generated file:

```yaml
---
url: https://example.com/article
slug: interesting-link
title: Interesting Article
source: 1
status: published
tags: [tech]
---
Commentary here...
```

### 2. Note Commands

**`ec note list`**

```bash
ec note list
ec note list --limit 10 --status draft
```

**`ec note show <slug>`**

```
Slug:      quick-thought
Status:    published
Created:   2026-01-28

---
Just a quick thought I wanted to share...
```

**`ec note create`**

```bash
ec note create --slug quick-thought --content "Just a quick thought"
ec note create --file note.md
```

**`ec note pull <slug>`**

```bash
ec note pull quick-thought
```

Generated file:

```yaml
---
slug: quick-thought
status: published
---
Just a quick thought I wanted to share...
```

### 3. File Structure

```
cli/src/commands/
├── link/
│   ├── index.ts
│   ├── list.ts
│   ├── show.ts
│   ├── create.ts
│   ├── edit.ts
│   ├── delete.ts
│   ├── publish.ts
│   └── unpublish.ts
├── note/
│   └── (same structure)
```

### 4. Shared Code

Refactor post commands to share:

- List formatting
- Show formatting
- Delete confirmation
- Publish/unpublish logic
- File-based create/edit/pull

```
cli/src/lib/
├── content.ts        # shared CRUD operations for all content types
```

### 5. Frontmatter Differences

| Field   | Post     | Link     | Note     |
| ------- | -------- | -------- | -------- |
| title   | required | optional | n/a      |
| slug    | required | required | required |
| url     | n/a      | required | n/a      |
| source  | n/a      | optional | n/a      |
| tags    | optional | optional | n/a      |
| excerpt | optional | optional | n/a      |
| banner  | optional | optional | optional |

## Testing

**Links:**

1. `ec link create --url "https://example.com" --slug test-link --content "Good read"` → creates
2. `ec link list` → shows test-link
3. `ec link show test-link` → displays with URL
4. `ec link pull test-link` → downloads with url in frontmatter
5. Edit file, `ec link edit test-link --file` → updates

**Notes:**

1. `ec note create --slug test-note --content "Quick thought"` → creates
2. `ec note list` → shows test-note
3. `ec note show test-note` → displays content
4. `ec note publish test-note` → publishes
5. `ec note delete test-note` → prompts, deletes

## Dependencies

- Plan 01 (scaffold)
- Plan 02 (post commands, API patterns)
- Plan 03 (file-based creation, image handling)

## API Changes Required

None (reuses existing post endpoints with type param)
