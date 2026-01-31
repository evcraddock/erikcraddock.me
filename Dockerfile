# Stage 1: Build
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Install all dependencies (including devDependencies for build tools)
COPY package.json bun.lock* ./
RUN bun install --ignore-scripts

# Copy source and build
COPY . .
RUN bun run css:build
RUN bun run build

# Stage 2: Production
# Use Node.js for production - Bun's ARM64 binary requires CPU features
# not available on Raspberry Pi 4 (causes SIGILL crash)
# Node.js 22+ has built-in SQLite (node:sqlite) - no native modules needed
FROM node:22-alpine
WORKDIR /app

# Copy package files and install production dependencies
# No native modules, so we can use --ignore-scripts
COPY package.json ./
RUN npm pkg delete scripts.prepare && npm install --omit=dev --ignore-scripts

# Copy built assets and migrations
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle

# Create data directory for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "--experimental-sqlite", "dist/index.cjs"]
