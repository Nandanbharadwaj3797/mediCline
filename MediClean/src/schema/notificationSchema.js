import mongoose from 'mongoose';
import { createSchema } from './baseSchema.js';

const recipientSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['unread', 'read', 'archived'],
    default: 'unread'
  },
  readAt: {
    type: Date,
    validate: {
      validator: function(value) {
        return !value || value <= new Date();
      },
      message: 'Read timestamp cannot be in the future'
    }
  },
  archivedAt: {
    type: Date,
    validate: {
      validator: function(value) {
        return !value || value <= new Date();
      },
      message: 'Archive timestamp cannot be in the future'
    }
  }
}, { _id: false });

const notificationFields = {
  // Broadcast notification fields (used when isBroadcast is true)
  isBroadcast: {
    type: Boolean,
    default: false,
    index: true
  },
  targetRoles: [{
    type: String,
    enum: ['clinic', 'collector', 'health']
  }],
  recipients: [recipientSchema],

  // Individual notification fields (used when isBroadcast is false)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() { return !this.isBroadcast; },
    index: true
  },
  status: {
    type: String,
    enum: ['unread', 'read', 'archived'],
    default: 'unread',
    required: function() { return !this.isBroadcast; },
    index: true
  },
  readAt: {
    type: Date,
    validate: {
      validator: function(value) {
        return !value || value <= new Date();
      },
      message: 'Read timestamp cannot be in the future'
    }
  },
  archivedAt: {
    type: Date,
    validate: {
      validator: function(value) {
        return !value || value <= new Date();
      },
      message: 'Archive timestamp cannot be in the future'
    }
  },

  // Common fields for both types
  type: {
    type: String,
    enum: [
      'pickup_request',
      'pickup_assigned',
      'pickup_completed',
      'pickup_cancelled',
      'waste_log_created',
      'waste_log_updated',
      'waste_threshold_exceeded',
      'system_maintenance',
      'emergency_alert',
      'account_update',
      'compliance_alert',
      'report_ready'
    ],
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    minlength: 3
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000,
    minlength: 10
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true
  },
  category: {
    type: String,
    enum: ['operational', 'administrative', 'system', 'emergency'],
    required: true,
    index: true
  },
  channel: {
    type: String,
    enum: ['in_app', 'email', 'sms', 'all'],
    default: 'in_app'
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
    validate: {
      validator: function(value) {
        if (!value) return true;
        return typeof value === 'object' && !Array.isArray(value);
      },
      message: 'Data must be a plain object'
    }
  },
  expiresAt: {
    type: Date,
    index: true,
    validate: {
      validator: function(value) {
        if (!value) return true;
        return value > new Date();
      },
      message: 'Expiration date must be in the future'
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return ['system_maintenance', 'emergency_alert'].includes(this.type);
    }
  },
  relatedEntity: {
    type: {
      type: String,
      enum: ['pickup_request', 'waste_log', 'report', 'user'],
      required: true
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'relatedEntity.type'
    }
  }
};

const notificationSchema = createSchema(notificationFields);

// Indexes
notificationSchema.index({ userId: 1, status: 1 });
notificationSchema.index({ userId: 1, type: 1 });
notificationSchema.index({ 'recipients.userId': 1, 'recipients.status': 1 });
notificationSchema.index({ category: 1, priority: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-deletion
notificationSchema.index({ 'relatedEntity.type': 1, 'relatedEntity.id': 1 });
notificationSchema.index({ isBroadcast: 1, targetRoles: 1 });

// Virtuals
notificationSchema.virtual('isExpired').get(function() {
  if (!this.expiresAt) return false;
  return Date.now() > this.expiresAt;
});

notificationSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt;
});

notificationSchema.virtual('isUrgent').get(function() {
  return this.priority === 'urgent';
});

// Methods
notificationSchema.methods.markAsRead = async function(userId) {
  const now = new Date();
  
  if (this.isBroadcast) {
    const recipient = this.recipients.find(r => r.userId.equals(userId));
    if (recipient && recipient.status === 'unread') {
      recipient.status = 'read';
      recipient.readAt = now;
    }
  } else if (this.userId.equals(userId) && this.status === 'unread') {
    this.status = 'read';
    this.readAt = now;
  }
  
  return this.save();
};

notificationSchema.methods.archive = async function(userId) {
  const now = new Date();
  
  if (this.isBroadcast) {
    const recipient = this.recipients.find(r => r.userId.equals(userId));
    if (recipient && recipient.status !== 'archived') {
      recipient.status = 'archived';
      recipient.archivedAt = now;
    }
  } else if (this.userId.equals(userId) && this.status !== 'archived') {
    this.status = 'archived';
    this.archivedAt = now;
  }
  
  return this.save();
};

// Statics
notificationSchema.statics.markAllRead = async function(userId) {
  const now = new Date();
  const bulkOps = [
    // Update individual notifications
    {
      updateMany: {
        filter: { 
          isBroadcast: false,
          userId,
          status: 'unread'
        },
        update: { 
          $set: { 
            status: 'read',
            readAt: now
          }
        }
      }
    },
    // Update recipient status in broadcast notifications
    {
      updateMany: {
        filter: { 
          isBroadcast: true,
          'recipients.userId': userId,
          'recipients.status': 'unread'
        },
        update: {
          $set: {
            'recipients.$.status': 'read',
            'recipients.$.readAt': now
          }
        }
      }
    }
  ];
  
  return this.bulkWrite(bulkOps);
};

notificationSchema.statics.getUnreadCount = async function(userId) {
  const [individualCount, broadcastCount] = await Promise.all([
    // Count unread individual notifications
    this.countDocuments({ 
      isBroadcast: false,
      userId, 
      status: 'unread',
      $or: [
        { expiresAt: { $gt: new Date() } },
        { expiresAt: null }
      ]
    }),
    // Count unread broadcast notifications
    this.countDocuments({ 
      isBroadcast: true,
      'recipients.userId': userId,
      'recipients.status': 'unread',
      $or: [
        { expiresAt: { $gt: new Date() } },
        { expiresAt: null }
      ]
    })
  ]);
  return individualCount + broadcastCount;
};

notificationSchema.statics.createBroadcastNotification = async function(data) {
  const notification = new this({
    ...data,
    isBroadcast: true,
    recipients: [], // Will be populated based on targetRoles
  });
  
  // Find all users with the target roles and add them as recipients
  if (data.targetRoles?.length) {
    const users = await mongoose.model('User').find({
      role: { $in: data.targetRoles },
      status: 'active',
      isDeleted: false
    });
    
    notification.recipients = users.map(user => ({
      userId: user._id,
      status: 'unread'
    }));
  }
  
  return notification.save();
};

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification; 