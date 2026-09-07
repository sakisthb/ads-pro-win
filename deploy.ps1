# ads-pro-win — Docker Production Deployment (Windows)
$TAG = if ($args[0]) { $args[0] } else { (git rev-parse --short HEAD) }
$COMPOSE_FILE = "docker-compose.production.yml"

Write-Host "Building Docker image (tag: $TAG)..." -ForegroundColor Cyan
docker build -t "ads-pro-win:$TAG" -t "ads-pro-win:latest" .

Write-Host "Starting Redis..." -ForegroundColor Cyan
docker compose -f $COMPOSE_FILE up -d redis --remove-orphans

Write-Host "Running migrations (fail-closed)..." -ForegroundColor Cyan
$migration = docker compose -f $COMPOSE_FILE run --rm --no-deps web npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "Migration failed. Deployment halted." -ForegroundColor Red
    exit 1
}

Write-Host "Starting application services..." -ForegroundColor Cyan
docker compose -f $COMPOSE_FILE up -d --remove-orphans

Write-Host "Checking health..." -ForegroundColor Cyan
Start-Sleep -Seconds 5
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -ErrorAction SilentlyContinue
if ($response.StatusCode -eq 200) {
    Write-Host "Deployment successful!" -ForegroundColor Green
} else {
    Write-Host "Health check failed. Check logs: docker compose -f $COMPOSE_FILE logs" -ForegroundColor Red
    exit 1
}
