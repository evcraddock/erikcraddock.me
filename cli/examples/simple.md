---
title: Example Post
slug: example-post
tags: [example, demo]
excerpt: A simple example post created from a markdown file.
type: article
---

# Welcome

This is an example post created using the CLI's file-based creation feature.

## Features

- **Frontmatter**: Title, slug, tags, and excerpt are extracted from YAML frontmatter
- **Markdown**: Full markdown support for content
- **Simple**: No images to upload, just text

## Code Example

```javascript
const greeting = "Hello, world!";
console.log(greeting);
```

## Next Steps

Try editing this post:

```bash
ec post pull example-post
# Edit example-post.md
ec post edit example-post --file example-post.md
```
