FROM oven/bun:1.3 AS base
WORKDIR /app

COPY shared/db ./shared/db
COPY db-poller ./db-poller

WORKDIR /app/shared/db
RUN bun install

WORKDIR /app/db-poller
RUN bun install

CMD ["bun", "run", "src/index.ts"]
