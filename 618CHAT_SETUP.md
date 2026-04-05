# 618chat Public Board Setup

Use these settings on the shared Render backend so `618chat` is public for every visitor:

## Required Render variables
- `PUBLIC_BOARD_STORE_PATH=/var/data/618chat-posts.json`
- `PUBLIC_BOARD_ADMIN_TOKEN=<long random secret>`
- `PUBLIC_BOARD_MAX_POSTS=300`

## Recommended Render disk
- Mount a persistent disk at `/var/data`
- That keeps the shared posts file alive across restarts and deploys

## How the page works
- `GET /api/618chat/posts` loads the board for everyone
- `POST /api/618chat/posts` adds a public post
- `DELETE /api/618chat/posts` clears the board only when `x-admin-token` matches `PUBLIC_BOARD_ADMIN_TOKEN`

## Notes
- The public board lives in the shared `johnny-chat` backend on Render.
- If the disk is missing, posts can disappear on redeploy or restart.
