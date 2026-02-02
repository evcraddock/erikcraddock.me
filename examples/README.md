# Example Content

This folder contains example articles and images for testing and development.

## Articles

The `articles/` folder contains 7 sample articles in the markdown format expected by the `ec` CLI.

### Format

```yaml
---
title: Article Title
slug: article-slug
type: article
excerpt: A short summary of the article.
tags: [tag1, tag2, tag3]
banner: ./images/banner-image.jpg
---
# Article content in markdown...
```

### Creating Articles

To create these articles via the CLI:

```bash
# First, upload the banner image
ec image upload examples/images/home-studio.jpg --key articles/home-studio.jpg

# Then create the article (update banner to use the uploaded image URL)
ec post create --file examples/articles/building-a-home-studio.md
```

Or manually update each article's `banner` field to point to the uploaded image URL before creating.

## Images

The `images/` folder contains banner images (1200x630px) for each article:

- `home-studio.jpg` - Building a Home Studio
- `typescript.jpg` - Why I Switched to TypeScript
- `morning-pages.jpg` - The Art of Morning Pages
- `guitar.jpg` - Learning Guitar at 40
- `boring-tech.jpg` - In Defense of Boring Technology
- `songwriting.jpg` - Writing Your First Song
- `digital-garden.jpg` - Growing a Digital Garden

## Topics

The example articles cover the three themes of the site:

**Writing:**

- The Art of Morning Pages
- Growing a Digital Garden

**Coding:**

- Why I Finally Switched to TypeScript
- In Defense of Boring Technology

**Music:**

- Building a Home Studio on a Budget
- Learning Guitar at 40
- Writing Your First Song
