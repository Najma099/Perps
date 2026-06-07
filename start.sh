#!/bin/sh
set -e

cd /app/db-poller && bun run src/index.ts &
sleep 2

cd /app/engine && bun run src/index.ts &
sleep 2

cd /app/ws-service && bun run src/index.ts &

cd /app/backend && bun run src/index.ts
