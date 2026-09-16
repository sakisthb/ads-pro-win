#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# ads-pro-win — Docker Production Deployment
# =============================================================================

TAG="${1:-$(git rev-parse --short HEAD)}"
COMPOSE_FILE="docker-compose.production.yml"
HEALTH_URL="http://localhost:3000/api/health"
MAX_RETRIES=10
RETRY_INTERVAL=3

# Support both the `docker compose` CLI plugin and standalone `docker-compose`
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  echo "❌ Docker Compose not found (need `docker compose` or `docker-compose`)." >&2
  exit 1
fi

echo "🚀 Deploying ads-pro-win (tag: $TAG)..."

env_value() {
  local line value
  line="$(grep -E "^${1}=" .env 2>/dev/null | tail -n1 || true)"
  value="${line#*=}"
  value="${value#\"}"
  value="${value%\"}"
  value="${value#\'}"
  value="${value%\'}"
  printf '%s' "$value"
}

if [[ -f .env ]]; then
  origin="$(env_value SACOS_GROWTH_ORIGIN)"
  token="$(env_value SACOS_GROWTH_DESK_TOKEN)"
  if [[ -z "$origin" ]]; then
    echo "Growth Center origin unset; desk stays unlinked until that domain exists."
  elif [[ "$origin" != https://* ]]; then
    echo "SACOS_GROWTH_ORIGIN must be HTTPS on the Growth Center domain, not 127.0.0.1." >&2
    exit 1
  elif [[ ${#token} -lt 32 ]]; then
    echo "SACOS_GROWTH_DESK_TOKEN (min 32 chars) is required when origin is set." >&2
    exit 1
  fi
fi

# Step 1: Build
echo "📦 Building Docker image..."
docker build -t ads-pro-win:"$TAG" -t ads-pro-win:latest .

# Step 2: Start Redis first (cheap dependency, required by worker and rate-limiter)
echo "🔄 Starting Redis..."
"$COMPOSE_CMD" -f "$COMPOSE_FILE" up -d redis --remove-orphans

# Step 3: Run database migrations before any web traffic starts (fail-closed)
echo "🗄️  Running Prisma migrations..."
if ! "$COMPOSE_CMD" -f "$COMPOSE_FILE" run --rm --no-deps web npx prisma migrate deploy; then
  echo "❌ Migration failed. Deployment halted."
  echo "🔄 To rollback: docker compose -f $COMPOSE_FILE down && git checkout HEAD~1 && ./deploy.sh"
  exit 1
fi

# Step 4: Start application services
echo "🔄 Starting application services..."
"$COMPOSE_CMD" -f "$COMPOSE_FILE" up -d --remove-orphans

# Step 5: Health check
echo "🏥 Waiting for health check..."
for i in $(seq 1 $MAX_RETRIES); do
  if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    echo "✅ Health check passed!"
    break
  fi
  if [ "$i" -eq "$MAX_RETRIES" ]; then
    echo "❌ Health check failed after $MAX_RETRIES attempts."
    echo "📋 Logs:"
    "$COMPOSE_CMD" -f "$COMPOSE_FILE" logs --tail=30
    echo ""
    echo "🔄 To rollback: docker compose -f $COMPOSE_FILE down && git checkout HEAD~1 && ./deploy.sh"
    exit 1
  fi
  echo "   Attempt $i/$MAX_RETRIES — retrying in ${RETRY_INTERVAL}s..."
  sleep "$RETRY_INTERVAL"
done

# Done
echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ Deployment successful!"
echo "  🏷️  Tag: $TAG"
echo "  🌐 URL: https://${DOMAIN:-localhost}"
echo "  🏥 Health: $HEALTH_URL"
echo "═══════════════════════════════════════════"
