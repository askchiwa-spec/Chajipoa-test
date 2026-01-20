#!/bin/bash
# environments/production-tanzania/deploy.sh

set -e

echo "🇹🇿 Starting CHAJIPOA Tanzania Production Deployment..."
echo "======================================================"

# Tanzania-specific configurations
TANZANIA_CONFIG="
REGION='af-south-1'
CDN_PROVIDER='cloudfront'
SMS_PROVIDER='africastalking'
PAYMENT_PROVIDERS=('azampay' 'mpesa' 'tigo' 'airtel')
LANGUAGES=('sw' 'en')
CURRENCY='TZS'
TIMEZONE='Africa/Dar_es_Salaam'
"

# Load Tanzania-specific environment
source .env.tanzania

# Check compliance requirements
echo "📋 Checking Tanzanian compliance..."
./scripts/check-compliance.sh tanzania

if [ $? -ne 0 ]; then
  echo "❌ Compliance check failed"
  exit 1
fi

# Deploy to AWS Africa region
echo "🌍 Deploying to Africa (Cape Town) region..."
aws configure set region af-south-1

# Deploy infrastructure
echo "🛠️  Deploying infrastructure..."
cd terraform/tanzania
terraform init
terraform apply -auto-approve
cd ../..

# Deploy application
echo "🚀 Deploying application..."
./environments/production/deploy.sh

# Configure Tanzania-specific features
echo "⚙️  Configuring Tanzania features..."
kubectl apply -f k8s/tanzania-specific/

# Test mobile money integrations
echo "💰 Testing mobile money integrations..."
./scripts/test-mobile-money.sh

echo "✅ Tanzania production deployment completed!"
echo "🌐 URL: https://chajipoa.co.tz"
echo "📱 USSD: *149*88#"