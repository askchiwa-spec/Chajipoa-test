const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: false,
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'USER_REGISTER',
      'USER_LOGIN',
      'USER_UPDATE',
      'RENTAL_START',
      'RENTAL_END',
      'RENTAL_CANCEL',
      'PAYMENT_INITIATED',
      'PAYMENT_COMPLETED',
      'PAYMENT_FAILED',
      'DEVICE_ASSIGN',
      'DEVICE_MAINTENANCE',
      'STATION_UPDATE',
      'SYSTEM_ERROR',
      'SECURITY_ALERT'
    ]
  },
  resourceType: {
    type: String,
    enum: ['user', 'rental', 'device', 'station', 'payment', 'system']
  },
  resourceId: String,
  ipAddress: String,
  userAgent: String,
  location: {
    latitude: Number,
    longitude: Number,
    city: String,
    country: String
  },
  requestData: mongoose.Schema.Types.Mixed,
  responseData: mongoose.Schema.Types.Mixed,
  statusCode: Number,
  errorMessage: String,
  severity: {
    type: String,
    enum: ['INFO', 'WARN', 'ERROR', 'CRITICAL'],
    default: 'INFO'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
    expires: 2592000 // 30 days TTL
  }
});

// Compound indexes for efficient querying
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ severity: 1, timestamp: -1 });
AuditLogSchema.index({ resourceType: 1, resourceId: 1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);