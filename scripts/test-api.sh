#!/bin/bash

echo "🧪 Testing CHAJIPOA API..."

# Test 1: Health endpoint
echo "1. Testing health endpoint..."
curl -s http://localhost:3000/api/v1/health | jq '.'

# Test 2: Register user
echo -e "\n2. Testing user registration..."
curl -X POST http://localhost:3000/api/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "0755123456",
    "first_name": "John",
    "last_name": "Bandawe",
    "user_type": "regular"
  }' | jq '.'

# Test 3: Verify with mock OTP (use the OTP from server logs)
echo -e "\n3. Testing OTP verification..."
echo "Check server logs for OTP, then run:"
echo "curl -X POST http://localhost:3000/api/v1/users/verify-otp \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"phone_number\": \"0755123456\", \"otp\": \"123456\"}'"

# Test 4: Get profile (after getting token)
echo -e "\n4. Testing profile endpoint (after auth)..."
curl -s -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/v1/users/profile | jq '.'

echo -e "\n5. Testing rental system endpoints..."
echo "Testing GET /api/v1/rentals/devices/available..."
curl -s -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/v1/rentals/devices/available | jq '.'

echo -e "\nTesting GET /api/v1/rentals/calculate-price..."
curl -s "http://localhost:3000/api/v1/rentals/calculate-price?hours=2" | jq '.'

echo -e "\nTesting GET /api/v1/rentals/active..."
curl -s -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/v1/rentals/active | jq '.'

echo -e "\nTesting GET /api/v1/rentals/history..."
curl -s -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/v1/rentals/history | jq '.'

echo -e "\n6. To test rental operations:"
echo "Start rental: curl -X POST http://localhost:3000/api/v1/rentals/start \"
echo "  -H 'Authorization: Bearer YOUR_TOKEN' \"
echo "  -H 'Content-Type: application/json' \"
echo "  -d '{\"device_id\":\"DEVICE_UUID\",\"station_from_id\":\"STATION_UUID\"}'"