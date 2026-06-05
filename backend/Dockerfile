FROM oven/bun:1.3 AS base
WORKDIR /app

COPY shared/db ./shared/db
COPY backend ./backend

WORKDIR /app/shared/db
RUN bun install

WORKDIR /app/backend
RUN bun install

EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
