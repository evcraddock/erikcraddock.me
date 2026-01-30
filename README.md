# erikcraddock.me

[![CI](https://github.com/evcraddock/erikcraddock.me/actions/workflows/ci.yml/badge.svg)](https://github.com/evcraddock/erikcraddock.me/actions/workflows/ci.yml)

Personal website and blog that can be followed from Mastodon via ActivityPub.

## Tech Stack

- **Hono** - Web framework
- **Fedify** - ActivityPub
- **Drizzle + SQLite** - Database
- **Hono JSX** - Templates
- **Tailwind** - Styles
- **Garage** - S3-compatible object storage (dev)
- **Mailpit** - Dev mail server

## CLI

The `ec` CLI provides content management from the command line.

### Install

```bash
curl -fsSL https://raw.githubusercontent.com/evcraddock/erikcraddock.me/main/install.sh | bash
```

Or download binaries directly from [Releases](https://github.com/evcraddock/erikcraddock.me/releases).

### Setup

```bash
ec login  # Opens browser to authenticate and stores API key
```

### Commands

```bash
ec post list                    # List posts
ec post create --file draft.md  # Create from markdown file
ec post edit my-post            # Edit a post
ec post publish my-post         # Publish a post

ec link create --url "..." --slug my-link --content "Commentary"
ec note create --slug thought --content "A quick note"

ec source list                  # List sources (blogroll)
ec source create --name "HN" --url "https://news.ycombinator.com"

ec tag list                     # List tags with counts

ec image upload ./photo.jpg --post my-post  # Upload image
ec image delete 42              # Delete image
```

Run `ec --help` or `ec <command> --help` for full usage.

## Getting Started

### Prerequisites

- Node.js 20+ or Bun 1.0+
- Docker and Docker Compose
- jq (for Garage setup script)

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

### Development Setup

The dev environment uses Docker for Garage (S3) and Mailpit (email).

```bash
# Start everything (app, CSS watcher, Docker services)
make dev

# First time only: setup Garage bucket and API keys
./scripts/setup-garage.sh

# Copy the S3 keys from the script output to your .env file
```

#### Dev Services

| Service      | Port | Description                               |
| ------------ | ---- | ----------------------------------------- |
| App          | 3000 | Main application                          |
| Mailpit UI   | 8025 | View sent emails at http://localhost:8025 |
| Mailpit SMTP | 1025 | SMTP server for dev                       |
| Garage S3    | 3900 | S3-compatible storage                     |
| Garage Admin | 3903 | Garage admin API                          |

### Running

```bash
# Start dev environment (daemonized with overmind)
make dev

# View logs
make dev-logs

# Stop
make dev-stop

# Check status
make dev-status
```

### Database

```bash
# Push schema changes to database
make db-push

# Seed database with sample data
make db-seed
```

## Testing

```bash
npm test
```

## Debug Logging

Set `LOG_LEVEL=debug` in your `.env` for verbose logging:

```
[16:14:32.123] DEBUG email Sending email {"to":"user@example.com","subject":"Magic Link"}
[16:14:32.456] DEBUG s3 Uploading file {"key":"123-abc.jpg","contentType":"image/jpeg"}
```

Log levels: `debug` | `info` | `warn` | `error`

## License

MIT
