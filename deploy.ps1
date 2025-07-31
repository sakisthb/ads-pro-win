# Ads Pro Enterprise - Deployment Script (PowerShell)
# AI-Powered Marketing Intelligence Platform

Write-Host "🚀 Starting Ads Pro Enterprise Deployment..." -ForegroundColor Green

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: Not in the project root directory" -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install

# Generate Prisma client
Write-Host "🗄️ Generating Prisma client..." -ForegroundColor Yellow
npx prisma generate

# Build the application
Write-Host "🔨 Building for production..." -ForegroundColor Yellow
npm run build

# Check if build was successful
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build successful!" -ForegroundColor Green
} else {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

# Deploy to Vercel
Write-Host "🚀 Deploying to Vercel..." -ForegroundColor Yellow
vercel --prod

Write-Host "🎉 Deployment completed!" -ForegroundColor Green
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Configure environment variables in Vercel dashboard" -ForegroundColor White
Write-Host "2. Set up database and run migrations" -ForegroundColor White
Write-Host "3. Test the deployed application" -ForegroundColor White
Write-Host "4. Monitor performance and errors" -ForegroundColor White 