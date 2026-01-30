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
# Use Node.js for production - Bun's ARM64 binary requires CPU features
# not available on Raspberry Pi 4 (causes SIGILL crash)
FROM node:22-alpine
WORKDIR /app

# Install build tools needed for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

# Copy package files and install production dependencies
# Note: better-sqlite3 needs to compile its native module, so we can't use --ignore-scripts
# But we skip the prepare script (husky) which isn't needed in production
COPY package.json ./
RUN npm pkg delete scripts.prepare && npm install --omit=dev

# Remove build tools after installation to reduce image size
RUN apk del python3 make g++

# Copy built assets and migrations
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle

# Create data directory for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/index.cjs"]
