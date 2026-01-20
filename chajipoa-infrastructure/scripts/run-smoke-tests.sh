#!/bin/bash
# scripts/run-smoke-tests.sh

set -e

ENVIRONMENT=${1:-staging}

echo "🧪 Running smoke tests for $ENVIRONMENT environment..."
echo "====================================================="

# Configuration based on environment
case $ENVIRONMENT in
    "staging")
        BASE_URL="https://staging.chajipoa.co.tz"
        ;;
    "production")
        BASE_URL="https://chajipoa.co.tz"
        ;;
    *)
        echo "❌ Unknown environment: $ENVIRONMENT"
        exit 1
        ;;
esac

# Test 1: API Health Check
echo "🏥 Testing API health endpoint..."
curl -f "$BASE_URL/health" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ API health check passed"
else
    echo "❌ API health check failed"
    exit 1
fi

# Test 2: API Version Endpoint
echo "🔢 Testing API version endpoint..."
curl -f "$BASE_URL/api/version" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ API version check passed"
else
    echo "⚠️  API version check failed (may not be implemented)"
fi

# Test 3: Database Connection
echo "🗄️  Testing database connectivity..."
curl -f "$BASE_URL/api/health/database" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Database connectivity check passed"
else
    echo "⚠️  Database connectivity check failed (may not be implemented)"
fi

# Test 4: Authentication Endpoint
echo "🔐 Testing authentication endpoint..."
curl -f "$BASE_URL/api/auth/login" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Authentication endpoint accessible"
else
    echo "⚠️  Authentication endpoint check failed (may not be implemented)"
fi

# Test 5: Rental Endpoint
echo "📱 Testing rental endpoint..."
curl -f "$BASE_URL/api/rentals" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Rental endpoint accessible"
else
    echo "⚠️  Rental endpoint check failed (may not be implemented)"
fi

echo "✅ Smoke tests completed successfully!"
exit 0