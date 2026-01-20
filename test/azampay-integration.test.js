// test/azampay-integration.test.js
// Test script for AzamPay integration

const AzamPayService = require('../src/services/AzamPayService');

async function testAzamPayIntegration() {
    console.log('🧪 Testing AzamPay Integration...\n');
    
    try {
        // Test 1: Connection Test
        console.log('1. Testing AzamPay Connection...');
        const connectionTest = await AzamPayService.testConnection();
        console.log('   ✅ Connection Test:', connectionTest);
        
        // Test 2: Get Supported Providers
        console.log('\n2. Getting Supported Providers...');
        const providers = AzamPayService.getSupportedProviders();
        console.log('   ✅ Supported Providers:', providers);
        
        // Test 3: Get Payment Partners (in sandbox mode)
        console.log('\n3. Getting Payment Partners...');
        const partners = await AzamPayService.getPaymentPartners();
        console.log('   ✅ Payment Partners:', partners);
        
        // Test 4: Sample Mobile Money Checkout (without actually processing)
        console.log('\n4. Testing Mobile Money Checkout Payload...');
        const samplePayment = {
            amount: 5000, // 5000 TZS
            currency: 'TZS',
            mobile: '+255712345678', // Test number
            provider: 'Mpesa',
            externalId: AzamPayService.generateExternalId(),
            description: 'Test payment for ChajiPoa power bank rental'
        };
        
        console.log('   📝 Sample Payment Data:', samplePayment);
        console.log('   ✅ Payment object created successfully');
        
        // Test 5: Validate required environment variables
        console.log('\n5. Validating Environment Variables...');
        const requiredEnvVars = [
            'AZAMPAY_SANDBOX',
            'AZAMPAY_CLIENT_ID', 
            'AZAMPAY_CLIENT_SECRET',
            'AZAMPAY_APP_NAME',
            'AZAMPAY_API_KEY'
        ];
        
        const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
        
        if (missingEnvVars.length === 0) {
            console.log('   ✅ All required environment variables are set');
        } else {
            console.log('   ⚠️  Missing environment variables:', missingEnvVars);
            console.log('   📝 Please set these variables in your .env file:');
            missingEnvVars.forEach(varName => {
                console.log(`      ${varName}=<your_${varName.toLowerCase()}_here>`);
            });
        }
        
        // Test 6: Test webhook signature verification
        console.log('\n6. Testing Webhook Signature Verification...');
        const testPayload = { transactionId: 'TEST_123', status: 'SUCCESS' };
        const testSignature = 'test_signature';
        const signatureResult = AzamPayService.verifyWebhookSignature(testPayload, testSignature);
        console.log('   ✅ Webhook signature verification method exists');
        
        console.log('\n🎯 AzamPay Integration Tests Completed!');
        console.log('\n📋 Integration Notes:');
        console.log('- Ensure your .env file contains all required AzamPay credentials');
        console.log('- Use sandbox mode for testing (AZAMPAY_SANDBOX=true)');
        console.log('- Mobile numbers must be in Tanzanian format (+255XXXXXXXXX)');
        console.log('- Supported providers: Mpesa, Tigo, Airtel, Halopesa, CRDB, NMB');
        console.log('- Webhook endpoint: POST /api/v1/azampay/webhook');
        console.log('- Payment status can be polled at GET /api/v1/azampay/poll-status/:transactionId');
        
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
if (require.main === module) {
    testAzamPayIntegration();
}

module.exports = testAzamPayIntegration;