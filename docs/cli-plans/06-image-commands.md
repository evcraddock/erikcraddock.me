# Plan 06: Image Commands

## Goal

Implement direct image upload and delete commands. Users can manage images outside of post creation.

## Deliverables

- [ ] `ec image upload <file>` with `--alt`, `--key`, `--post` options
- [ ] `ec image delete <id>`
- [ ] Output shows image ID and URL after upload

## Implementation

### 1. Image Upload

**`ec image upload <file>`**

```bash
# Basic upload (auto-generated key)
ec image upload ./photo.jpg
# → Uploaded: id=42, url=https://erikcraddock.me/media/abc123.jpg

# With alt text
ec image upload ./photo.jpg --alt "A sunset over mountains"

# With explicit key
ec image upload ./photo.jpg --key "posts/my-post/hero.jpg"

# With post slug (sets key automatically)
ec image upload ./photo.jpg --post my-post
# → key becomes: posts/my-post/photo.jpg

# With post slug and custom filename
ec image upload ./photo.jpg --post my-post --key banner.jpg
# → key becomes: posts/my-post/banner.jpg
```

**Output:**

```
✓ Uploaded image
  ID:   42
  URL:  https://erikcraddock.me/media/posts/my-post/photo.jpg
  Key:  posts/my-post/photo.jpg
```

**JSON output:**

```bash
ec image upload ./photo.jpg --json
```

```json
{
  "id": 42,
  "url": "https://erikcraddock.me/media/posts/my-post/photo.jpg",
  "key": "posts/my-post/photo.jpg",
  "filename": "photo.jpg",
  "mime_type": "image/jpeg"
}
```

### 2. Image Delete

**`ec image delete <id>`**

```bash
ec image delete 42
# Prompt: "Delete image 42? [y/N]"
# → Image deleted
```

With `--yes` flag (skip confirmation):

```bash
ec image delete 42 --yes
```

### 3. File Structure

```
cli/src/commands/
├── image/
│   ├── index.ts
│   ├── upload.ts
│   └── delete.ts
```

### 4. Key Resolution Logic

In `upload.ts`:

```typescript
function resolveKey(file: string, options: { key?: string; post?: string }): string | undefined {
  const filename = path.basename(file);

  if (options.post && options.key) {
    // --post my-post --key banner.jpg → posts/my-post/banner.jpg
    return `posts/${options.post}/${options.key}`;
  }

  if (options.post) {
    // --post my-post → posts/my-post/photo.jpg
    return `posts/${options.post}/${filename}`;
  }

  if (options.key) {
    // --key custom/path.jpg → custom/path.jpg
    return options.key;
  }

  // No key specified, let API auto-generate
  return undefined;
}
```

### 5. Upload Implementation

```typescript
async function uploadImage(filePath: string, options: Options) {
  const file = await fs.readFile(filePath);
  const filename = path.basename(filePath);
  const mimeType = getMimeType(filePath); // based on extension

  const formData = new FormData();
  formData.append("file", new Blob([file], { type: mimeType }), filename);

  if (options.alt) {
    formData.append("alt", options.alt);
  }

  const key = resolveKey(filePath, options);
  if (key) {
    formData.append("key", key);
  }

  const response = await api.post("/media", formData);
  return response.data;
}
```

### 6. Supported Formats

Validate before upload:

- `.jpg` / `.jpeg` → `image/jpeg`
- `.png` → `image/png`
- `.gif` → `image/gif`
- `.webp` → `image/webp`

Error on unsupported formats.

## Testing

1. `ec image upload ./test.jpg` → uploads, shows ID and URL
2. Visit URL in browser → image displays
3. `ec image upload ./test.jpg --post my-post` → uploads with post key
4. `ec image upload ./test.jpg --alt "Test image"` → uploads with alt text
5. `ec image upload ./test.jpg --post my-post` again → overwrites (same key)
6. `ec image delete <id>` → prompts, deletes
7. Visit URL again → 404

## Dependencies

- Plan 01 (scaffold, config)

## API Changes Required

None (uses existing `/api/media` endpoints)
