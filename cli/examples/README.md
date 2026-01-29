# CLI Examples

Sample markdown files for testing file-based post creation.

## Files

### simple.md

A basic post with just frontmatter and content. No images.

```bash
ec post create --file examples/simple.md
```

### with-images.md

A post with local image references. Images are uploaded automatically.

```bash
# Copy sample image first
cp examples/sample-image.jpg ./hero.jpg

ec post create --file examples/with-images.md
```

### note.md

A quick note (no title required).

```bash
ec post create --file examples/note.md
```

## Workflow Example

1. Create a post from file:

   ```bash
   ec post create --file examples/simple.md
   ```

2. Pull it back to edit:

   ```bash
   ec post pull example-post
   ```

3. Edit the downloaded file, then update:

   ```bash
   ec post edit example-post --file example-post.md
   ```

4. Publish when ready:
   ```bash
   ec post publish example-post
   ```

## Image Handling

Local images (`./path.jpg`) are uploaded to the server and URLs are rewritten.

You can also reference existing images by ID:

```markdown
![photo](image:42)
```

This fetches the URL for image #42 from the server.
