# ActivityPub Production Tests

Manual integration tests to verify ActivityPub endpoints on production return correct URLs and data.

## Why These Tests Exist

Federation issues (especially http vs https URLs) can break Mastodon compatibility silently. These tests catch problems before users report them.

## When to Run

- After deploying changes to ActivityPub/federation code
- After changing proxy or URL configuration
- When debugging federation issues
- Periodically as a health check

## Production Details

- **URL**: https://erikcraddock.me
- **Actor**: @erik@erikcraddock.me

## Test Files

| File                         | Endpoint                | What it tests                    |
| ---------------------------- | ----------------------- | -------------------------------- |
| [actor.md](actor.md)         | `/users/erik`           | Actor profile, keys, URLs        |
| [outbox.md](outbox.md)       | `/users/erik/outbox`    | Outbox collection and pagination |
| [followers.md](followers.md) | `/users/erik/followers` | Followers collection             |

## Key Verifications

All tests verify that URLs use `https://` (not `http://`). This is critical for federation - Mastodon and other servers will reject or ignore activities with http URLs.

## Running Tests

Execute each test file's commands and verify the expected output. The agent should:

1. Run the curl command
2. Check each verification point
3. Report any failures with the actual value received
