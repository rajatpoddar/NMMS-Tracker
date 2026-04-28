# ─── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Copy only package files first — better layer caching
# If package.json doesn't change, this layer is reused on rebuild
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# ─── Stage 2: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

# Copy source — prisma first (generate needs schema)
COPY prisma ./prisma
RUN npx prisma generate

# Copy rest of source
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://x:x@localhost:5432/x"
RUN npm run build

# ─── Stage 3: Runner (minimal image) ─────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=Asia/Kolkata

RUN apk add --no-cache tzdata \
    && ln -snf /usr/share/zoneinfo/Asia/Kolkata /etc/localtime \
    && echo "Asia/Kolkata" > /etc/timezone

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Standalone build output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma for migrations at runtime
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Photos directory
RUN mkdir -p /app/data/photos && chown nextjs:nodejs /app/data/photos

# Entrypoint
COPY --chown=nextjs:nodejs docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["/app/docker-entrypoint.sh"]
