import mongoose from 'mongoose';
import { createSchema, commonSchemas } from './baseSchema.js';

const statusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'assigned', 'collected', 'cancelled'],
    required: true
  },
  updatedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  note: {
    type: String,
    maxLength: [200, 'Note cannot exceed 200 characters'],
    trim: true
  }
}, { _id: false });

const pickupRequestFields = {
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Clinic ID is required for pickup requests'],
    index: true
  },
  collectorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  wasteLogs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WasteLog'
  }],
  wasteType: {
    type: String,
    enum: {
      values: ['sharps', 'biohazard', 'expired_meds', 'others'],
      message: 'Invalid waste type. Must be one of: sharps, biohazard, expired_meds, others'
    },
    required: [true, 'Waste type is required'],
    index: true
  },
  volumeKg: {
    type: Number,
    required: [true, 'Volume in kg is required'],
    min: [0, 'Volume must be a positive number'],
    max: [1000, 'Volume cannot exceed 1000 kg'],
    validate: {
      validator: Number.isFinite,
      message: 'Volume must be a valid number'
    }
  },
  priority: {
    type: String,
    enum: {
      values: ['low', 'medium', 'high', 'urgent'],
      message: 'Invalid priority level. Must be one of: low, medium, high, urgent'
    },
    default: 'medium',
    index: true
  },
  description: {
    type: String,
    maxLength: [500, 'Description cannot exceed 500 characters'],
    trim: true
  },
  scheduledPickup: {
    preferredDate: {
      type: Date,
      required: function() { return this.isScheduled; },
      validate: {
        validator: function(date) {
          return date > new Date();
        },
        message: 'Preferred date must be in the future'
      }
    },
    preferredTimeSlot: {
      start: {
        type: String,
        validate: {
          validator: function(time) {
            return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
          },
          message: 'Time must be in HH:MM format'
        }
      },
      end: {
        type: String,
        validate: {
          validator: function(time) {
            return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
          },
          message: 'Time must be in HH:MM format'
        }
      }
    },
    isScheduled: {
      type: Boolean,
      default: false
    }
  },
  emergency: {
    isEmergency: {
      type: Boolean,
      default: false
    },
    reason: {
      type: String,
      required: function() { return this.emergency.isEmergency; },
      maxLength: [500, 'Emergency reason cannot exceed 500 characters']
    },
    responseDeadline: {
      type: Date,
      required: function() { return this.emergency.isEmergency; },
      validate: {
        validator: function(date) {
          return date > new Date();
        },
        message: 'Response deadline must be in the future'
      }
    }
  },
  routeDetails: {
    sequence: Number,
    estimatedArrival: Date,
    estimatedDuration: {
      type: Number,
      min: [0, 'Duration must be positive']
    },
    distance: {
      type: Number,
      min: [0, 'Distance must be positive']
    },
    route: {
      type: {
        type: String,
        enum: ['LineString'],
        default: 'LineString'
      },
      coordinates: [[Number]]
    }
  },
  location: {
    type: new mongoose.Schema(commonSchemas.location, { _id: false }),
    required: true
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'assigned', 'collected', 'cancelled'],
      message: 'Invalid status. Must be one of: pending, assigned, collected, cancelled'
    },
    default: 'pending',
    index: true
  },
  statusHistory: [statusHistorySchema],
  collectionDetails: {
    actualWeight: {
      type: Number,
      min: [0, 'Actual weight must be positive']
    },
    containerCount: {
      type: Number,
      min: [0, 'Container count must be positive']
    },
    photosUrls: [String],
    signature: {
      clinicStaff: String,
      collector: String,
      timestamp: Date
    },
    notes: {
      type: String,
      maxLength: [500, 'Notes cannot exceed 500 characters']
    }
  },
  qualityControl: {
    wasteSegregation: {
      type: String,
      enum: ['good', 'fair', 'poor']
    },
    packagingQuality: {
      type: String,
      enum: ['good', 'fair', 'poor']
    },
    comments: {
      type: String,
      maxLength: [500, 'Comments cannot exceed 500 characters']
    }
  },
  requestedAt: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  collectedAt: {
    type: Date,
    index: true
  },
  cancelledAt: {
    type: Date
  },
  cancellationReason: {
    type: String,
    maxLength: [500, 'Cancellation reason cannot exceed 500 characters'],
    trim: true
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: {
    type: Date
  }
};

const pickupRequestSchema = createSchema(pickupRequestFields);

// Indexes
pickupRequestSchema.index({ location: '2dsphere' });
pickupRequestSchema.index({ 'statusHistory.updatedAt': 1 });
pickupRequestSchema.index({ cancellationReason: 'text' });
pickupRequestSchema.index({ 'wasteType': 1, 'requestedAt': 1 });
pickupRequestSchema.index({ clinicId: 1, status: 1 });
pickupRequestSchema.index({ collectorId: 1, status: 1 });
pickupRequestSchema.index({ 'emergency.isEmergency': 1, status: 1 });
pickupRequestSchema.index({ 'scheduledPickup.preferredDate': 1, status: 1 });
pickupRequestSchema.index({ priority: 1, requestedAt: 1 });

// Virtuals
pickupRequestSchema.virtual('responseTime').get(function() {
  if (this.status === 'collected' && this.collectedAt) {
    return this.collectedAt - this.requestedAt;
  }
  return null;
});

pickupRequestSchema.virtual('isOverdue').get(function() {
  if (this.status === 'pending') {
    const now = new Date();
    const requestTime = new Date(this.requestedAt);
    const hoursSinceRequest = (now - requestTime) / (1000 * 60 * 60);
    
    // Consider priority for overdue calculation
    const overdueLimits = {
      urgent: 2, // 2 hours
      high: 6,   // 6 hours
      medium: 24, // 24 hours
      low: 48     // 48 hours
    };
    
    return hoursSinceRequest > overdueLimits[this.priority];
  }
  return false;
});

pickupRequestSchema.virtual('waitTime').get(function() {
  if (this.status === 'assigned' || this.status === 'collected') {
    const assignedStatus = this.statusHistory.find(h => h.status === 'assigned');
    if (assignedStatus) {
      return assignedStatus.updatedAt - this.requestedAt;
    }
  }
  return null;
});

// Additional virtuals and methods
pickupRequestSchema.virtual('isEditable').get(function() {
  return ['pending', 'assigned'].includes(this.status) && !this.isDeleted;
});

pickupRequestSchema.virtual('isDeletable').get(function() {
  return this.status === 'pending' && !this.isDeleted;
});

pickupRequestSchema.virtual('isEmergencyExpired').get(function() {
  if (this.emergency.isEmergency && this.emergency.responseDeadline) {
    return new Date() > this.emergency.responseDeadline;
  }
  return false;
});

pickupRequestSchema.virtual('totalWasteVolume').get(function() {
  if (!this.wasteLogs || this.wasteLogs.length === 0) return this.volumeKg;
  return this.wasteLogs.reduce((sum, log) => sum + (log.volumeKg || 0), 0);
});

// Pre-save middleware
pickupRequestSchema.pre('save', function(next) {
  // Ensure statusHistory is updated when status changes
  if (this.isModified('status')) {
    if (!this.statusHistory) this.statusHistory = [];
    this.statusHistory.push({
      status: this.status,
      updatedAt: new Date()
    });
  }

  // Set priority based on emergency status
  if (this.emergency.isEmergency && this.priority !== 'urgent') {
    this.priority = 'urgent';
  }

  next();
});

// Static methods
pickupRequestSchema.statics.validateBulk = async function(requests) {
  const errors = [];
  for (const [index, request] of requests.entries()) {
    try {
      await new this(request).validate();
    } catch (error) {
      errors.push({ index, errors: error.errors });
    }
  }
  return errors;
};

pickupRequestSchema.statics.findNearby = async function(coordinates, maxDistance = 5000, filters = {}) {
  return this.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates
        },
        $maxDistance: maxDistance
      }
    },
    ...filters,
    isDeleted: false
  });
};

pickupRequestSchema.statics.getStatistics = async function(filters = {}) {
  const match = { isDeleted: false, ...filters };
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          status: '$status',
          wasteType: '$wasteType',
          priority: '$priority'
        },
        count: { $sum: 1 },
        totalVolume: { $sum: '$volumeKg' },
        avgResponseTime: {
          $avg: {
            $cond: [
              { $eq: ['$status', 'collected'] },
              { $subtract: ['$collectedAt', '$requestedAt'] },
              null
            ]
          }
        }
      }
    },
    {
      $group: {
        _id: null,
        byStatus: {
          $push: {
            status: '$_id.status',
            count: '$count',
            totalVolume: '$totalVolume',
            avgResponseTime: '$avgResponseTime'
          }
        },
        byWasteType: {
          $push: {
            wasteType: '$_id.wasteType',
            count: '$count',
            totalVolume: '$totalVolume'
          }
        },
        byPriority: {
          $push: {
            priority: '$_id.priority',
            count: '$count',
            avgResponseTime: '$avgResponseTime'
          }
        }
      }
    }
  ]);
};

// Methods
pickupRequestSchema.methods.addStatusHistory = function(status, note = '') {
  if (!this.statusHistory) this.statusHistory = [];
  this.statusHistory.push({
    status,
    note,
    updatedAt: new Date()
  });
  this.status = status;
};

pickupRequestSchema.methods.validateStatusTransition = function(newStatus) {
  const validTransitions = {
    pending: ['assigned', 'cancelled'],
    assigned: ['collected', 'cancelled'],
    collected: [],
    cancelled: []
  };

  if (!validTransitions[this.status]?.includes(newStatus)) {
    throw new Error(`Invalid status transition from ${this.status} to ${newStatus}`);
  }
};

export default mongoose.model('PickupRequest', pickupRequestSchema);
