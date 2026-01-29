# Plan 05: Sources and Tags

## Goal

Implement source management and tag listing. Sources provide attribution for links.

## Deliverables

- [ ] `ec source list`
- [ ] `ec source show <id>`
- [ ] `ec source create --name --url [--feed-url]`
- [ ] `ec source edit <id> [--name] [--url] [--feed-url]`
- [ ] `ec source delete <id>` with confirmation
- [ ] `ec tag list`
- [ ] API: `PUT /api/sources/:id`
- [ ] API: `DELETE /api/sources/:id`
- [ ] API: `GET /api/tags`

## Implementation

### 1. Source Commands

**`ec source list`**

```bash
ec source list
ec source list --json
```

Output:

```
ID    NAME              URL
1     Hacker News       https://news.ycombinator.com
2     Lobsters          https://lobste.rs
3     My Blog           https://example.com
```

**`ec source show <id>`**

```bash
ec source show 1
```

Output:

```
ID:        1
Name:      Hacker News
URL:       https://news.ycombinator.com
Feed URL:  https://news.ycombinator.com/rss
```

**`ec source create`**

```bash
ec source create --name "Hacker News" --url "https://news.ycombinator.com"
ec source create --name "Hacker News" --url "https://news.ycombinator.com" --feed-url "https://news.ycombinator.com/rss"
```

**`ec source edit <id>`**

```bash
ec source edit 1 --name "HN"
ec source edit 1 --url "https://hn.algolia.com"
ec source edit 1 --feed-url "https://hnrss.org/frontpage"
```

**`ec source delete <id>`**

```bash
ec source delete 1
# Prompt: "Delete source 'Hacker News'? This may affect linked posts. [y/N]"
```

### 2. Tag Commands

**`ec tag list`**

```bash
ec tag list
ec tag list --json
```

Output:

```
TAG          COUNT
tech         12
rust         8
golang       5
personal     3
```

### 3. File Structure

```
cli/src/commands/
├── source/
│   ├── index.ts
│   ├── list.ts
│   ├── show.ts
│   ├── create.ts
│   ├── edit.ts
│   └── delete.ts
├── tag/
│   ├── index.ts
│   └── list.ts
```

### 4. API Changes

**`PUT /api/sources/:id`**

```typescript
api.put("/sources/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const { name, url, feed_url } = await c.req.json();

  // Validate
  // Update via updateSource()
  // Return updated source
});
```

**`DELETE /api/sources/:id`**

```typescript
api.delete("/sources/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);

  // Check if source is used by any posts?
  // Or just allow delete and set posts' source_id to null
  // Delete via deleteSource()
  // Return 204
});
```

**`GET /api/tags`**

```typescript
api.get("/tags", (c) => {
  // Query: SELECT tag, COUNT(*) as count FROM post_tags GROUP BY tag ORDER BY count DESC
  const tags = listTags();
  return c.json({ data: tags });
});
```

### 5. Service Layer

Add to `src/services/sources.ts`:

```typescript
export function updateSource(id: number, data: {...}): Source | null
export function deleteSource(id: number): boolean
```

Add to `src/services/posts.ts` or new `src/services/tags.ts`:

```typescript
export function listTags(): { tag: string; count: number }[];
```

## Testing

**Sources:**

1. `ec source create --name "Test Source" --url "https://test.com"` → creates, returns ID
2. `ec source list` → shows Test Source
3. `ec source show 1` → displays details
4. `ec source edit 1 --name "Updated Source"` → updates
5. `ec source delete 1` → prompts, deletes

**Tags:**

1. Create posts with various tags
2. `ec tag list` → shows tags with counts
3. `ec tag list --json` → JSON output

## Dependencies

- Plan 01 (scaffold)
- Plan 02 (API patterns)

## API Changes Required

| Endpoint                  | Status  |
| ------------------------- | ------- |
| `GET /api/sources`        | Exists  |
| `GET /api/sources/:id`    | Exists  |
| `POST /api/sources`       | Exists  |
| `PUT /api/sources/:id`    | **New** |
| `DELETE /api/sources/:id` | **New** |
| `GET /api/tags`           | **New** |
