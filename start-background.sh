#!/bin/sh
set -e

cd /app/db-poller && bun run src/index.ts &
sleep 2

cd /app/engine && bun run src/index.ts &
sleep 2

cd /app/scripts && bun run market-feed.ts &
sleep 2

cd /app/scripts && bun run worker.ts &

wait
