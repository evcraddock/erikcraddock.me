# Example Content

Example content for testing: articles, linkblogs, and notes.

## Seed Dev Database

```bash
./examples/seed-articles.sh
```

Requires dev server running (`make dev`) and `cli/dev-config.yaml` configured.

## Content

| Folder      | Type    | Count | Description                        |
| ----------- | ------- | ----- | ---------------------------------- |
| `articles/` | article | 7     | Long-form posts with banner images |
| `links/`    | link    | 3     | Linkblogs with commentary          |
| `notes/`    | note    | 5     | Short thoughts                     |
| `images/`   | -       | 7     | Banner images for articles         |
