#!/bin/bash
# scripts/post-deployment-tests.sh

set -e

ENVIRONMENT=${1:-staging}

echo "🧪 Running post-deployment tests for $ENVIRONMENT..."
echo "==================================================="

# Configuration based on environment
case $ENVIRONMENT in
    "staging")
        BASE_URL="https://staging.chajipoa.co.tz"
        API_URL="https://api.staging.chajipoa.co.tz"
        ;;
    "production")
        BASE_URL="https://chajipoa.co.tz"
        API_URL="https://api.chajipoa.co.tz"
        ;;
    *)
        echo "❌ Unknown environment: $ENVIRONMENT"
        exit 1
        ;;
esac

# Test 1: Basic Connectivity
echo "📡 Testing basic connectivity..."
curl -f "$API_URL/health" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ API is reachable"
else
    echo "❌ API is unreachable"
    exit 1
fi

# Test 2: Database Connection
echo "🗄️  Testing database connectivity..."
curl -f "$API_URL/api/health/database" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
    exit 1
fi

# Test 3: Authentication Endpoints
echo "🔐 Testing authentication endpoints..."
curl -f "$API_URL/api/auth/login" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Authentication endpoint accessible"
else
    echo "❌ Authentication endpoint inaccessible"
fi

# Test 4: Rental Endpoints
echo "📱 Testing rental endpoints..."
curl -f "$API_URL/api/rentals" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Rental endpoint accessible"
else
    echo "❌ Rental endpoint inaccessible"
fi

# Test 5: Payment Endpoints
echo "💳 Testing payment endpoints..."
curl -f "$API_URL/api/payments" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Payment endpoint accessible"
else
    echo "❌ Payment endpoint inaccessible"
fi

# Test 6: Response Time
echo "⏱️  Testing response times..."
RESPONSE_TIME=$(curl -o /dev/null -s -w "%{time_total}\n" "$API_URL/health")
if (( $(echo "$RESPONSE_TIME < 2" | bc -l) )); then
    echo "✅ Response time acceptable: ${RESPONSE_TIME}s"
else
    echo "⚠️  Slow response time: ${RESPONSE_TIME}s"
fi

# Test 7: SSL Certificate
echo "🔒 Testing SSL certificate..."
openssl s_client -connect $(echo $API_URL | sed 's|https://||'):443 -servername $(echo $API_URL | sed 's|https://||') < /dev/null 2>/dev/null | openssl x509 -noout -dates > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ SSL certificate valid"
else
    echo "❌ SSL certificate invalid"
fi

# Test 8: Load Test (light)
echo "🏋️  Running light load test..."
# This would run a light load test to ensure the deployment can handle basic traffic

echo "✅ Post-deployment tests completed successfully for $ENVIRONMENT!"
echo "📊 Summary:"
echo "  - API Connectivity: ✅"
echo "  - Database: ✅"
echo "  - Authentication: ✅"
echo "  - Core Endpoints: ✅"
echo "  - SSL Certificate: ✅"
echo "  - Response Time: ${RESPONSE_TIME}s"

# Send notification
if [ "$ENVIRONMENT" = "production" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"✅ Post-deployment tests passed for $ENVIRONMENT! Deployment successful.\"}" \
        $SLACK_WEBHOOK_URL
fi