# Pin bun — `latest` (1.3.14) fails extracting the Next 16 tarball in Docker.
FROM oven/bun:1.3.4 AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
# Next's tarball is large; Docker's default /tmp tmpfs often cannot hold the extract.
ENV TMPDIR=/app/.tmp
RUN mkdir -p "$TMPDIR" \
    && bun install --frozen-lockfile --network-concurrency 1 \
    || bun install --frozen-lockfile --network-concurrency 1

# Build the app
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Next inlines this at `next build`. Use the Docker-network API hostname
# so rewrites never loop out through Cloudflare.
ARG BACKEND_URL=http://api:3000
ENV BACKEND_URL=$BACKEND_URL

# Baked into the browser bundle — must be correct at docker build time
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_WS_HOST
ENV NEXT_PUBLIC_WS_HOST=$NEXT_PUBLIC_WS_HOST

RUN bun run build

# Runner environment
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Fallback if not passed at runtime; prefer compose/env override
ENV BACKEND_URL=http://api:3000

# Copy standalone build
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["bun", "run", "server.js"]
