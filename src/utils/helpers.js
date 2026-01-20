const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Generate random string
const generateRandomString = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Generate OTP
const generateOTP = (length = 6) => {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
};

// Hash password
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(12);
  return await bcrypt.hash(password, salt);
};

// Compare password
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Generate JWT token
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  });
};

// Verify JWT token
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

// Generate rental code
const generateRentalCode = () => {
  const prefix = 'RNT';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

// Generate transaction code
const generateTransactionCode = (type = 'TXN') => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${type}${timestamp}${random}`;
};

// Generate device code
const generateDeviceCode = () => {
  const prefix = 'PB'; // Power Bank
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

// Calculate rental cost
const calculateRentalCost = (startTime, endTime, hourlyRate = 500) => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const hours = (end - start) / (1000 * 60 * 60);
  const totalHours = Math.ceil(hours * 2) / 2; // Round to nearest 0.5 hours
  const baseAmount = totalHours * hourlyRate;
  const taxAmount = baseAmount * 0.18; // 18% VAT
  const totalAmount = baseAmount + taxAmount;
  
  return {
    totalHours,
    baseAmount,
    taxAmount,
    totalAmount
  };
};

// Validate phone number (Tanzanian format)
const validatePhoneNumber = (phoneNumber) => {
  const tanzaniaPhoneRegex = /^(\+255|255|0)[67][0-9]{8}$/;
  return tanzaniaPhoneRegex.test(phoneNumber);
};

// Format phone number to international format
const formatPhoneNumber = (phoneNumber) => {
  let formatted = phoneNumber.replace(/\s+/g, '');
  
  if (formatted.startsWith('+255')) {
    return formatted;
  } else if (formatted.startsWith('255')) {
    return `+${formatted}`;
  } else if (formatted.startsWith('0')) {
    return `+255${formatted.substring(1)}`;
  }
  
  return `+255${formatted}`;
};

// Calculate distance between two GPS coordinates (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in kilometers
};

// Mask sensitive data
const maskSensitiveData = (data, fields = ['phone_number', 'email']) => {
  const masked = { ...data };
  
  if (fields.includes('phone_number') && masked.phone_number) {
    const phone = masked.phone_number;
    masked.phone_number = `${phone.substring(0, 4)}****${phone.substring(phone.length - 2)}`;
  }
  
  if (fields.includes('email') && masked.email) {
    const [local, domain] = masked.email.split('@');
    masked.email = `${local.substring(0, 2)}***@${domain}`;
  }
  
  return masked;
};

module.exports = {
  generateRandomString,
  generateOTP,
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  generateRentalCode,
  generateTransactionCode,
  generateDeviceCode,
  calculateRentalCost,
  validatePhoneNumber,
  formatPhoneNumber,
  calculateDistance,
  maskSensitiveData
};