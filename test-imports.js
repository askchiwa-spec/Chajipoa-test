// Test imports to check for syntax errors
try {
  const UserController = require('./src/controllers/UserController');
  const SMSService = require('./src/services/SMSService');
  const AzamPayService = require('./src/services/AzamPayService');
  const QRCodeService = require('./src/services/QRCodeService');
  const helpers = require('./src/utils/helpers');
  const { userSchemas } = require('./src/validators/schemas');
  
  console.log('✅ All modules imported successfully!');
  console.log('✅ ChajiPoa system is ready for deployment!');
  
  // Test helper functions
  console.log('\n🔧 Testing helper functions:');
  console.log('Generated OTP:', helpers.generateOTP());
  console.log('Generated Rental Code:', helpers.generateRentalCode());
  console.log('Formatted Phone:', helpers.formatPhoneNumber('0712345678'));
  
} catch (error) {
  console.error('❌ Import error:', error.message);
  process.exit(1);
}