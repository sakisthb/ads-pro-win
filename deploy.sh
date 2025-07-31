#!/bin/bash

# Ads Pro Enterprise - Deployment Script
# AI-Powered Marketing Intelligence Platform

echo "🚀 Starting Ads Pro Enterprise Deployment..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in the project root directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo "🗄️ Generating Prisma client..."
npx prisma generate

# Build the application
echo "🔨 Building for production..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed!"
    exit 1
fi

# Deploy to Vercel
echo "🚀 Deploying to Vercel..."
vercel --prod

echo "🎉 Deployment completed!"
echo "📋 Next steps:"
echo "1. Configure environment variables in Vercel dashboard"
echo "2. Set up database and run migrations"
echo "3. Test the deployed application"
echo "4. Monitor performance and errors" 