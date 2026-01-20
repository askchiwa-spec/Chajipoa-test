const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  deviceInfo: {
    userAgent: String,
    ip: String,
    deviceId: String
  },
  location: {
    latitude: Number,
    longitude: Number,
    city: String,
    country: String
  },
  qrSession: {
    qrCode: String,
    deviceCode: String,
    stationId: String,
    expiresAt: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 // 24 hours TTL
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient querying
SessionSchema.index({ userId: 1, isActive: 1 });
SessionSchema.index({ sessionId: 1, isActive: 1 });
SessionSchema.index({ 'qrSession.expiresAt': 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Session', SessionSchema);