import mongoose from 'mongoose';
import { createSchema } from './baseSchema.js';

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    enum: [
      'create', 'update', 'delete', 'view', 'login', 'logout',
      'status_change', 'assign', 'complete', 'export', 'import',
      'schedule', 'cancel', 'approve', 'reject', 'verify',
      'reset_password', 'change_role', 'archive'
    ],
    required: true,
    index: true
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'error', 'critical'],
    default: 'info',
    index: true
  },
  entityType: {
    type: String,
    enum: ['user', 'waste_log', 'pickup_request', 'report', 'notification', 'settings'],
    required: true,
    index: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  userRole: {
    type: String
  },
  status: {
    type: String,
    enum: ['success', 'failure'],
    default: 'success'
  },
  changes: mongoose.Schema.Types.Mixed,
  errorDetails: {
    code: String,
    message: String,
    stack: String
  },
  metadata: {
    ip: String,
    userAgent: String,
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        validate: {
          validator: function(coords) {
            return Array.isArray(coords) && 
                   coords.length === 2 && 
                   coords[0] >= -180 && 
                   coords[0] <= 180 && 
                   coords[1] >= -90 && 
                   coords[1] <= 90;
          },
          message: 'Invalid coordinates. Longitude must be between -180 and 180, latitude between -90 and 90.'
        }
      }
    }
  }
}, { timestamps: true });

// TTL Index for automatic cleanup of old records
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

// Enhanced Methods
auditLogSchema.methods.addError = function(error, severity = 'error') {
  this.status = 'failure';
  this.severity = severity;
  this.errorDetails = {
    code: error.code || 'UNKNOWN_ERROR',
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  };
  return this.save();
};

// Enhanced Statics
auditLogSchema.statics.logAction = async function(data) {
  const {
    action,
    entityType,
    entityId,
    performedBy,
    userRole,
    changes,
    metadata,
    status = 'success',
    severity = 'info'
  } = data;

  const auditLog = new this({
    action,
    entityType,
    entityId,
    performedBy,
    userRole,
    changes,
    metadata,
    status,
    severity
  });

  return auditLog.save();
};

// Get recent system activity
auditLogSchema.statics.getRecentActivity = function(options = {}) {
  const { 
    startDate, 
    endDate, 
    entityTypes, 
    actions, 
    severities,
    limit = 50, 
    skip = 0 
  } = options;

  const query = {};

  if (startDate && endDate) {
    query.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  if (entityTypes) query.entityType = { $in: entityTypes };
  if (actions) query.action = { $in: actions };
  if (severities) query.severity = { $in: severities };

  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('performedBy', 'username email role');
};

// Get critical or failed events
auditLogSchema.statics.getCriticalEvents = function(options = {}) {
  const { startDate, endDate, limit = 50 } = options;

  const query = {
    $or: [
      { severity: 'critical' },
      { status: 'failure' }
    ]
  };

  if (startDate && endDate) {
    query.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('performedBy', 'username email role');
};

export default mongoose.model('AuditLog', auditLogSchema);