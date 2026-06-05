FROM oven/bun:1.3 AS build
WORKDIR /app

COPY frontend ./frontend
WORKDIR /app/frontend
RUN bun install

ARG VITE_API_URL
ARG VITE_WS_URL
RUN bun run build

FROM nginx:alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
