# CLI Examples

Sample markdown files for testing file-based content creation.

## Content Types

| Type     | Purpose                             | Required Fields      |
| -------- | ----------------------------------- | -------------------- |
| **Post** | Long-form blog articles             | title, slug, content |
| **Link** | Share external URLs with commentary | url, slug, content   |
| **Note** | Quick thoughts, status updates      | slug, content        |

## Files

### simple.md

A basic post with just frontmatter and content. No images.

```bash
ec post create --file examples/simple.md
```

### with-images.md

A post with local image references and banner. Images are uploaded automatically.

```bash
ec post create --file examples/with-images.md
```

### link.md

A link to an external article with your commentary.

```bash
ec link create --file examples/link.md
```

### note.md

A quick note (no title required).

```bash
ec note create --file examples/note.md
```

## Workflow Examples

### Posts

```bash
# Create a post from file
ec post create --file examples/simple.md

# Pull it back to edit
ec post pull example-post

# Edit the downloaded file, then update
ec post edit example-post --file example-post.md

# Publish when ready
ec post publish example-post
```

### Links

```bash
# Create a link from CLI
ec link create --url "https://example.com" --slug cool-article --content "Great read"

# Or from file
ec link create --file examples/link.md

# List all links
ec link list

# Publish
ec link publish cool-article
```

### Notes

```bash
# Create a quick note
ec note create --slug shipped --content "Just deployed v2.0 🚀"

# Or from file
ec note create --file examples/note.md

# List notes
ec note list

# Publish
ec note publish shipped
```

## Image Handling

Local images (`./path.jpg`) are uploaded to the server and URLs are rewritten.

You can also reference existing images by ID:

```markdown
![photo](image:42)
```

This fetches the URL for image #42 from the server.

## Frontmatter Reference

### Post Frontmatter

```yaml
---
title: My Post Title
slug: my-post-slug
type: article
tags: [tech, programming]
excerpt: A short summary
banner: ./hero.png
---
```

### Link Frontmatter

```yaml
---
url: https://example.com/article
slug: link-slug
title: Optional Title
tags: [tech]
excerpt: Optional summary
source: 1 # Source ID (e.g., Hacker News)
---
```

### Note Frontmatter

```yaml
---
slug: note-slug
---
```

Notes are minimal - just a slug and content.
