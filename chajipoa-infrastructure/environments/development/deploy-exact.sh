#!/bin/bash
# environments/development/deploy.sh

set -e

echo "🚀 Starting CHAJIPOA Development Deployment..."
echo "============================================"

# Load environment variables
source .env.development

# Build Docker images
echo "📦 Building Docker images..."
docker-compose build --no-cache

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Start new containers
echo "▶️  Starting containers..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Run database migrations
echo "🗄️  Running database migrations..."
docker-compose exec api npm run migrate

# Seed development data
echo "🌱 Seeding development data..."
docker-compose exec api npm run seed

# Run tests
echo "🧪 Running tests..."
docker-compose exec api npm test

# Health check
echo "🏥 Performing health check..."
curl -f http://localhost:3000/health || exit 1

echo "✅ Development deployment completed successfully!"
echo "🌐 Frontend: http://localhost:3001"
echo "🔧 API: http://localhost:3000"
echo "📊 Admin: http://localhost:3001/admin"