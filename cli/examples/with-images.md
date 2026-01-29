---
title: Post with Images
slug: image-demo-post
tags: [images, demo]
excerpt: Demonstrates local image upload and URL rewriting.
banner: ./sample-image.png
type: article
---

# Image Demo

This post demonstrates how local images are handled.

## Banner Image

The frontmatter includes a `banner` field pointing to a local file:

```yaml
banner: ./sample-image.png
```

When you create this post, the CLI:

1. Detects the local image path
2. Uploads it to the server
3. Rewrites the path to the final URL

## Inline Images

You can also include images in the content:

![Sample Image](./sample-image.png)

## How It Works

Local paths like `./image.png` or `../images/photo.png` are:

- Resolved relative to the markdown file
- Uploaded to `/media/posts/{slug}/{filename}`
- Replaced with the full URL

External URLs (`https://...`) are left unchanged.

## Try It

1. Make sure `sample-image.png` exists in the examples folder
2. Run: `ec post create --file examples/with-images.md`
3. Check the created post - images will have server URLs
