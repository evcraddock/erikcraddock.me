# Plan 02: Post Commands

## Goal

Implement CRUD commands for articles. User can list, view, create, edit, delete, and publish posts via CLI.

## Deliverables

- [x] `ec post list` with `--limit`, `--tag`, `--status` filters
- [x] `ec post show <slug>`
- [x] `ec post create --title --slug --content [--excerpt] [--tags]`
- [x] `ec post edit <slug> [--title] [--content] [--excerpt] [--tags]`
- [x] `ec post delete <slug>` with confirmation
- [x] `ec post publish <slug>`
- [x] `ec post unpublish <slug>`
- [x] API: slug-based lookups for posts (done in #1396)
- [x] API: status filter for list
- [x] Table and JSON output formats

## Implementation

### 1. API Changes

**Add slug-based routes in `src/routes/api.tsx`:**

```typescript
// GET /api/posts/by-slug/:slug
api.get("/posts/by-slug/:slug", ...)

// Or modify existing routes to accept slug:
// GET /api/posts/:idOrSlug - detect if numeric or string
```

**Add status filter to list:**

```typescript
// GET /api/posts?type=article&status=draft
```

### 2. CLI Commands

**`ec post list`**

```
ec post list
ec post list --limit 10
ec post list --tag tech
ec post list --status draft
ec post list --json
```

Output (table):

```
SLUG                  TITLE                    STATUS      DATE
my-great-post         My Great Post            draft       2026-01-28
another-post          Another Post             published   2026-01-27
```

**`ec post show <slug>`**

```
ec post show my-great-post
```

Output:

```
Title:     My Great Post
Slug:      my-great-post
Status:    draft
Created:   2026-01-28
Tags:      tech, rust

---
Content here in markdown...
```

**`ec post create`**

```
ec post create --title "My Post" --slug my-post --content "# Hello\n\nContent here"
ec post create --title "My Post" --slug my-post --content "..." --tags tech,rust --excerpt "Short summary"
```

**`ec post edit <slug>`**

```
ec post edit my-post --title "Updated Title"
ec post edit my-post --content "New content"
ec post edit my-post --tags tech,go  # replaces all tags
```

**`ec post delete <slug>`**

```
ec post delete my-post
# Prompt: "Delete 'My Post'? [y/N]"
```

**`ec post publish/unpublish <slug>`**

```
ec post publish my-post
# → Post 'my-post' published

ec post unpublish my-post
# → Post 'my-post' unpublished
```

### 3. File Structure

```
cli/src/commands/
├── post/
│   ├── index.ts      # subcommand routing
│   ├── list.ts
│   ├── show.ts
│   ├── create.ts
│   ├── edit.ts
│   ├── delete.ts
│   ├── publish.ts
│   └── unpublish.ts
```

## Testing

1. `ec post create --title "Test" --slug test-post --content "Hello"` → creates post
2. `ec post list` → shows test-post in table
3. `ec post show test-post` → displays full post
4. `ec post edit test-post --title "Updated"` → updates title
5. `ec post publish test-post` → publishes
6. `ec post list --status published` → shows test-post
7. `ec post delete test-post` → prompts, deletes

## Dependencies

- Plan 01 (scaffold, config, auth)

## API Changes Required

| Endpoint                          | Change                            |
| --------------------------------- | --------------------------------- |
| `GET /api/posts`                  | Add `status` query param          |
| `GET /api/posts/:slug`            | Support slug lookup (not just ID) |
| `PUT /api/posts/:slug`            | Support slug lookup               |
| `DELETE /api/posts/:slug`         | Support slug lookup               |
| `POST /api/posts/:slug/publish`   | Support slug lookup               |
| `POST /api/posts/:slug/unpublish` | Support slug lookup               |
