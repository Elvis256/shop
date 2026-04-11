# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npx tsc --project tsconfig.build.json

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache openssl

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/prisma ./prisma

# Install production dependencies only
RUN npm ci --omit=dev && npx prisma generate

# Uploads directory
RUN mkdir -p /app/uploads

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs && \
    chown -R appuser:nodejs /app
USER appuser

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
