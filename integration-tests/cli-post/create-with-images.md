# Test: Create Post with Images and Banner

Test creating posts with local images and banner that get uploaded and displayed.

## Setup

Verify sample image exists:

```bash
ls -la cli/examples/sample-image.png
```

## Create Post with Image and Banner

```bash
cd cli
bun run src/index.ts post create --file examples/with-images.md
```

**Expected:**

```
📤 Processing 1 image(s)...
✅ Post created: image-demo-post
   Title: Post with Images
   Type: article
   Status: draft
   Tags: Images, Demo
   Source: examples/with-images.md
```

## Verify Image Was Uploaded

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/media/posts/image-demo-post/sample-image.png
```

**Expected:** `200`

## Verify URL Was Rewritten in Content

```bash
bun run src/index.ts post pull image-demo-post --output /tmp/pulled.md
grep "sample-image" /tmp/pulled.md
```

**Expected:** Shows `/media/posts/image-demo-post/sample-image.png` (not `./sample-image.png`)

## Publish and View Banner in Browser

```bash
bun run src/index.ts post publish image-demo-post

~/.local/share/pi-skills/browser-tools/browser-nav.js http://localhost:5000/posts/image-demo-post
sleep 1
~/.local/share/pi-skills/browser-tools/browser-screenshot.js
```

**Expected:**

- Banner image displays at the TOP of the post (above the title)
- Title "Post with Images" appears below the banner
- Inline image displays in the content

## Cleanup

```bash
bun run src/index.ts post delete image-demo-post --force
rm /tmp/pulled.md
```
