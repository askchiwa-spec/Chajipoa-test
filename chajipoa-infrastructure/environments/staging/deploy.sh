#!/bin/bash
# environments/staging/deploy.sh

set -e

echo "🚀 Starting CHAJIPOA Staging Deployment..."
echo "========================================="

# Load environment variables
source .env.staging

# Build and push Docker image
echo "📦 Building and pushing Docker image..."
docker build -t $DOCKER_REGISTRY/chajipoa-api:$GIT_COMMIT_SHA .
docker push $DOCKER_REGISTRY/chajipoa-api:$GIT_COMMIT_SHA

# Update Kubernetes deployment
echo "☸️  Updating Kubernetes deployment..."
kubectl set image deployment/chajipoa-api \
  api=$DOCKER_REGISTRY/chajipoa-api:$GIT_COMMIT_SHA \
  -n chajipoa-staging

# Wait for rollout to complete
echo "⏳ Waiting for rollout..."
kubectl rollout status deployment/chajipoa-api -n chajipoa-staging

# Run database migrations
echo "🗄️  Running migrations..."
kubectl exec -n chajipoa-staging deploy/chajipoa-api -- npm run migrate

# Run smoke tests
echo "🧪 Running smoke tests..."
./scripts/run-smoke-tests.sh staging

# Update ingress if needed
echo "🔗 Updating ingress..."
kubectl apply -f k8s/ingress.yaml

echo "✅ Staging deployment completed!"
echo "🌐 URL: https://staging.chajipoa.co.tz"