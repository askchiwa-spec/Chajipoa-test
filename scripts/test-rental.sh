#!/bin/bash

echo "🧪 Testing CHAJIPOA Rental System..."
echo "===================================="

# Get auth token first (assuming you have a test user)
echo "1. Getting authentication token..."
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/users/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "0755111001", "otp": "123456"}' | jq -r '.data.token')

if [ "$TOKEN" = "null" ]; then
  echo "❌ Failed to get token. Make sure user exists and OTP is correct."
  echo "   Try registering first: curl -X POST http://localhost:3000/api/v1/users/register \\"
  echo "     -H 'Content-Type: application/json' \\"
  echo "     -d '{\"phone_number\":\"0755111001\",\"first_name\":\"Test\"}'"
  exit 1
fi

echo "✅ Token obtained: ${TOKEN:0:20}..."

# Test 2: Get available devices
echo -e "\n2. Testing available devices..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/rentals/devices/available" | jq '.'

# Test 3: Calculate price
echo -e "\n3. Testing price calculation..."
curl -s "http://localhost:3000/api/v1/rentals/calculate-price?hours=2.5" | jq '.'

# Test 4: Get active rental (should be none initially)
echo -e "\n4. Checking active rental..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/rentals/active" | jq '.'

# Test 5: Get rental history
echo -e "\n5. Testing rental history..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/rentals/history?limit=5" | jq '.'

echo -e "\n🎉 Rental system tests completed!"
echo -e "\nTo test a full rental flow:"
echo "1. Get device ID from available devices"
echo "2. Start rental: curl -X POST http://localhost:3000/api/v1/rentals/start \\"
echo "   -H 'Authorization: Bearer \$TOKEN' \\"
echo "   -H 'Content-Type: application/json' \\"
echo "   -d '{\"device_id\":\"DEVICE_UUID\",\"station_from_id\":\"STATION_UUID\"}'"