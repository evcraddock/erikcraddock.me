# Plan 03: File-Based Post Creation

## Goal

Create and edit posts from markdown files with frontmatter. Handle image uploads and URL rewriting.

## Deliverables

- [ ] `ec post create --file draft.md`
- [ ] `ec post pull <slug>` downloads post as markdown
- [ ] `ec post edit <slug> --file updated.md`
- [ ] Frontmatter parsing (title, slug, tags, excerpt, banner)
- [ ] Local image upload with URL rewriting
- [ ] Image ID syntax support (`image:42`)

## Implementation

### 1. Frontmatter Parser

Parse YAML frontmatter from markdown files:

```yaml
---
title: My Great Article
slug: my-great-article
tags: [tech, rust]
excerpt: A short summary
banner: ./hero.jpg
---
Content here...
```

Use a library like `gray-matter` or parse manually.

### 2. Image Processing

**Detect local images:**

- Frontmatter `banner: ./path.jpg`
- Markdown `![alt](./path.jpg)`
- Markdown `![alt](../relative/path.jpg)`
- Skip external URLs (`https://...`)
- Skip image IDs (`image:42`)

**Upload flow:**

1. Find all local image paths
2. Resolve paths relative to markdown file
3. Upload each to `/api/media` with key `posts/{slug}/{filename}`
4. Build URL map: `./hero.jpg` → `https://erikcraddock.me/media/posts/my-post/hero.jpg`
5. Replace paths in content and frontmatter
6. For `image:42` syntax, fetch image URL from API and replace

### 3. Commands

**`ec post create --file draft.md`**

1. Read and parse markdown file
2. Extract frontmatter (slug required)
3. Process images (upload, rewrite URLs)
4. Create post via API
5. Print success with post URL

**`ec post pull <slug>`**

1. Fetch post via API
2. Generate frontmatter from post data
3. Write to `{slug}.md` or `--output` path
4. Print: "Downloaded to ./my-post.md"

```bash
ec post pull my-post
ec post pull my-post --output ./drafts/article.md
```

**Generated file:**

```yaml
---
title: My Great Article
slug: my-great-article
status: published
tags: [tech, rust]
excerpt: A short summary
created: 2026-01-28
---
Content with full image URLs...
```

**`ec post edit <slug> --file updated.md`**

1. Read and parse markdown file
2. Process any new local images
3. Update post via API
4. Print success

### 4. File Structure

```
cli/src/lib/
├── markdown.ts       # frontmatter parsing
├── images.ts         # image detection, upload, URL rewriting
```

### 5. Edge Cases

- **Missing slug in frontmatter:** Error with clear message
- **Image file not found:** Error, list missing files
- **Image upload fails:** Error, don't create post
- **Overwrite existing image:** Same key replaces (by design)

## Testing

1. Create `test.md`:

   ```yaml
   ---
   title: Test Post
   slug: test-file-post
   banner: ./test-image.jpg
   ---
   Content with ![inline](./another.png)
   ```

2. `ec post create --file test.md` → uploads images, creates post

3. Visit site → images display correctly

4. `ec post pull test-file-post` → downloads markdown

5. Edit downloaded file, `ec post edit test-file-post --file test-file-post.md` → updates

## Dependencies

- Plan 01 (scaffold, config)
- Plan 02 (post commands, API slug support)

## API Changes Required

None (uses existing endpoints)
