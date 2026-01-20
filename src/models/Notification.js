const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'RENTAL_REMINDER',
      'OVERDUE_WARNING',
      'PAYMENT_CONFIRMATION',
      'DEPOSIT_RETURN',
      'MAINTENANCE_ALERT',
      'SYSTEM_UPDATE',
      'PROMOTIONAL',
      'SECURITY_ALERT'
    ]
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'MEDIUM'
  },
  channels: [{
    type: String,
    enum: ['SMS', 'EMAIL', 'PUSH', 'IN_APP'],
    default: ['IN_APP']
  }],
  status: {
    type: String,
    enum: ['PENDING', 'SENT', 'DELIVERED', 'FAILED', 'READ'],
    default: 'PENDING'
  },
  relatedEntity: {
    type: {
      entityType: {
        type: String,
        enum: ['rental', 'payment', 'device', 'user']
      },
      entityId: String
    }
  },
  scheduledFor: Date,
  sentAt: Date,
  readAt: Date,
  failureReason: String,
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Indexes for efficient querying
NotificationSchema.index({ userId: 1, status: 1 });
NotificationSchema.index({ status: 1, scheduledFor: 1 });
NotificationSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);