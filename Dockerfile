FROM node:24-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
# Extract the prisma CLI's full transitive dependency closure (resolved from
# the lockfile) into /prisma-cli for the runtime image. Hand-curated COPY
# lists drift: @prisma/config pulls in effect, c12, fast-check, ... transitively.
RUN node -e 'const fs=require("fs"),path=require("path");const seen=new Set();function resolvePkg(fromDir,name){let dir=path.resolve(fromDir);while(true){const cand=path.join(dir,"node_modules",name);if(fs.existsSync(cand))return cand;const parent=path.dirname(dir);if(parent===dir)return null;dir=parent;}}function walk(pkgDir){if(!pkgDir||seen.has(pkgDir))return;seen.add(pkgDir);const pkg=JSON.parse(fs.readFileSync(path.join(pkgDir,"package.json"),"utf8"));for(const dep of Object.keys(pkg.dependencies||{}))walk(resolvePkg(pkgDir,dep));}walk(resolvePkg("/app","prisma"));for(const dir of seen){const rel=path.relative("/app",dir);const dest=path.join("/prisma-cli",rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.cpSync(dir,dest,{recursive:true});}'

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `next build` forces NODE_ENV=production, so env validation runs during the
# build and cannot be skipped (by design — see src/env.ts). The placeholder
# values below mirror the CI workflow env block and exist only so a bare
# `docker build` can complete. They are non-sensitive, they do not persist
# into the runner stage, and real values are injected at runtime via the
# docker-compose `env_file`. Real secrets are never passed as build args —
# only NEXT_PUBLIC_* values (inlined into client bundles at build time).
ARG NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
ARG NEXT_PUBLIC_SITE_URL=https://build.placeholder.invalid
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/adspro_build \
    SUPABASE_SERVICE_ROLE_KEY=placeholder-service-role-key \
    ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000 \
    REDIS_HOST=localhost \
    REDIS_PORT=6379 \
    REDIS_PASSWORD=build-placeholder-redis-password \
    REDIS_DB=0 \
    INTERNAL_RATE_LIMIT_SECRET=build-placeholder-secret-must-be-at-least-32-chars \
    TRUSTED_PROXY_HOPS=1 \
    RATE_LIMIT_ENABLED=false
RUN npx prisma generate
RUN npm run build
RUN npx esbuild src/worker-entry.ts --bundle --platform=node --outfile=dist/workers/main.js --external:ioredis --external:bullmq --external:@prisma/client

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy worker dependencies not traced by Next.js standalone
# (only worker-entry.ts imports bullmq/ioredis, so standalone output omits
# bullmq and its transitive deps: cron-parser → luxon, msgpackr,
# node-abort-controller, tslib. semver IS traced in, but as a file-pruned
# copy without index.js — copying the full package merges the missing files)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bullmq ./node_modules/bullmq
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/ioredis ./node_modules/ioredis
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/cron-parser ./node_modules/cron-parser
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/luxon ./node_modules/luxon
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/msgpackr ./node_modules/msgpackr
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/node-abort-controller ./node_modules/node-abort-controller
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/tslib ./node_modules/tslib
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/semver ./node_modules/semver
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
# Prisma CLI pinned to the schema's version so `npx prisma migrate deploy`
# runs offline; without it npx fetches the latest prisma from npm at deploy
# time (version drift against the v6 schema). /prisma-cli (built in the deps
# stage) holds the CLI's full transitive dependency closure.
COPY --from=deps --chown=nextjs:nodejs /prisma-cli/node_modules ./node_modules
RUN mkdir -p node_modules/.bin && ln -s ../prisma/build/index.js node_modules/.bin/prisma
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
# 127.0.0.1, not localhost: Alpine resolves localhost to ::1 first, but the
# standalone server binds IPv4 0.0.0.0, so a localhost probe is refused.
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/api/health?probe=live || exit 1
CMD ["node", "server.js"]
