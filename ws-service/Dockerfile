FROM oven/bun:1.3 AS base
WORKDIR /app

COPY ws-service ./ws-service

WORKDIR /app/ws-service
RUN bun install

EXPOSE 8080
CMD ["bun", "run", "src/index.ts"]
