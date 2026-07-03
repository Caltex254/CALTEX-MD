# =============================================================================
# CALTEX MD - Multi-stage Dockerfile for Next.js Dashboard
# =============================================================================

# ---- Stage 1: Dependencies ----
FROM node:20-alpine AS deps

LABEL maintainer="Caltex MD Team"
LABEL description="CALTEX MD WhatsApp Bot Dashboard - Dependency Stage"

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files for dependency installation
COPY package.json package-lock.json* bun.lock* ./
COPY prisma ./prisma/

# Install dependencies (including devDependencies for build stage)
RUN if [ -f bun.lock ]; then \
      npm install -g bun && bun install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then \
      npm ci; \
    else \
      npm install; \
    fi

# ---- Stage 2: Builder ----
FROM node:20-alpine AS builder

LABEL maintainer="Caltex MD Team"
LABEL description="CALTEX MD WhatsApp Bot Dashboard - Build Stage"

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set build-time environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Generate Prisma client
RUN npx prisma generate

# Build the Next.js application
RUN npm run build

# ---- Stage 3: Runner ----
FROM node:20-alpine AS runner

LABEL maintainer="Caltex MD Team"
LABEL description="CALTEX MD WhatsApp Bot Dashboard - Production"
LABEL version="1.0.0"
LABEL org.opencontainers.image.title="Caltex MD Dashboard"
LABEL org.opencontainers.image.description="WhatsApp Bot Management Dashboard"
LABEL org.opencontainers.image.source="https://github.com/caltex-md/caltex-md"

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application from builder stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

# Copy node_modules for Prisma and runtime dependencies
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Create necessary directories and set ownership
RUN mkdir -p /app/logs /app/sessions /app/media /app/backups && \
    chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose the application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the application
CMD ["node", "server.js"]
