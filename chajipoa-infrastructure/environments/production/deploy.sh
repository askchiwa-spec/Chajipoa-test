#!/bin/bash
# environments/production/deploy.sh

set -e

echo "🚀 Starting CHAJIPOA Production Deployment..."
echo "============================================"

# Validate environment
if [ "$DEPLOY_ENV" != "production" ]; then
  echo "❌ This script can only be run in production environment"
  exit 1
fi

# Create backup before deployment
echo "💾 Creating backup..."
./scripts/backup-database.sh production
./scripts/backup-files.sh production

# Apply Terraform changes
echo "🔄 Applying Terraform configuration..."
cd terraform
terraform apply -auto-approve -var-file=production.tfvars
cd ..

# Deploy with blue-green strategy
echo "🎨 Starting blue-green deployment..."

# Deploy green environment
echo "🟢 Deploying green environment..."
kubectl apply -f k8s/green/

# Wait for green to be ready
echo "⏳ Waiting for green deployment..."
kubectl rollout status deployment/chajipoa-api-green -n chajipoa-production

# Run health checks on green
echo "🏥 Running health checks..."
./scripts/health-check.sh green.chajipoa.co.tz

if [ $? -eq 0 ]; then
  # Switch traffic to green
  echo "🔄 Switching traffic to green..."
  kubectl apply -f k8s/ingress-green.yaml
  
  # Wait for traffic to shift
  sleep 30
  
  # Scale down blue
  echo "🔵 Scaling down blue..."
  kubectl scale deployment/chajipoa-api-blue --replicas=0 -n chajipoa-production
  
  echo "✅ Production deployment completed successfully!"
  
  # Send deployment notification
  curl -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"✅ CHAJIPOA production deployment completed successfully!\"}" \
    $SLACK_WEBHOOK_URL
else
  echo "❌ Health check failed, rolling back..."
  
  # Roll back to blue
  kubectl apply -f k8s/ingress-blue.yaml
  
  # Scale down green
  kubectl scale deployment/chajipoa-api-green --replicas=0 -n chajipoa-production
  
  # Send alert
  curl -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"❌ CHAJIPOA production deployment failed! Rolled back to previous version.\"}" \
    $SLACK_WEBHOOK_URL
  
  exit 1
fi