# Stage 1: Build
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Install all dependencies (including devDependencies for build tools)
# Use --ignore-scripts to skip native module compilation (not needed for build)
COPY package.json bun.lock* ./
RUN bun install --ignore-scripts

# Copy source and build
COPY . .
RUN bun run css:build
RUN bun run build

# Stage 2: Production
FROM oven/bun:1-alpine
WORKDIR /app

# Copy built assets and migrations
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle

# Install production dependencies only (no native modules needed)
# Production code uses bun:sqlite which is built into Bun
COPY package.json bun.lock* ./
RUN bun install --production --ignore-scripts

# Create data directory for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "run", "dist/index.js"]
