# ads-pro-win — Docker Production Deployment (Windows)
$TAG = if ($args[0]) { $args[0] } else { (git rev-parse --short HEAD) }
$COMPOSE_FILE = "docker-compose.production.yml"

if (Test-Path .env) {
    $origin = (Select-String -Path .env -Pattern '^SACOS_GROWTH_ORIGIN=' | Select-Object -Last 1).Line
    $token = (Select-String -Path .env -Pattern '^SACOS_GROWTH_DESK_TOKEN=' | Select-Object -Last 1).Line
    $origin = if ($origin) { $origin.Substring($origin.IndexOf('=') + 1).Trim('"').Trim("'") } else { "" }
    $token = if ($token) { $token.Substring($token.IndexOf('=') + 1).Trim('"').Trim("'") } else { "" }
    if (-not $origin) {
        Write-Host "Growth Center origin unset; desk stays unlinked until that domain exists."
    } elseif ($origin -notlike "https://*") {
        Write-Host "SACOS_GROWTH_ORIGIN must be HTTPS on the Growth Center domain, not 127.0.0.1." -ForegroundColor Red
        exit 1
    } elseif ($token.Length -lt 32) {
        Write-Host "SACOS_GROWTH_DESK_TOKEN (min 32 chars) is required when origin is set." -ForegroundColor Red
        exit 1
    }
}

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
