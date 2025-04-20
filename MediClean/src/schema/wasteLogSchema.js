import mongoose from 'mongoose';
import { createSchema, commonSchemas } from './baseSchema.js';

const wasteLogFields = {
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: ['sharps', 'biohazard', 'expired_meds', 'others'],
    required: true,
    index: true
  },
  subcategory: {
    type: String,
    required: function() { return this.category === 'others'; }
  },
  volumeKg: {
    type: Number,
    required: true,
    min: [0, 'Volume must be a positive number']
  },
  description: {
    type: String,
    maxLength: 500,
    trim: true
  },
  handlingInstructions: {
    type: String,
    required: function() {
      return ['biohazard', 'expired_meds'].includes(this.category);
    }
  },
  storageConditions: {
    temperature: {
      min: Number,
      max: Number
    },
    humidity: {
      min: Number,
      max: Number
    },
    specialRequirements: [String]
  },
  containerInfo: {
    type: {
      type: String,
      enum: ['bag', 'box', 'container', 'other'],
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    condition: {
      type: String,
      enum: ['new', 'used', 'damaged'],
      required: true
    }
  },
  images: [{
    url: String,
    caption: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  location: commonSchemas.location,
  loggedAt: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  pickupRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PickupRequest',
    index: true
  }
};

const wasteLogSchema = createSchema(wasteLogFields);

// Indexes
wasteLogSchema.index({ location: '2dsphere' });
wasteLogSchema.index({ category: 1, loggedAt: 1 });
wasteLogSchema.index({ clinicId: 1, loggedAt: 1 });
wasteLogSchema.index({ pickupRequestId: 1, loggedAt: 1 });
wasteLogSchema.index({ 'containerInfo.type': 1, loggedAt: 1 });

// Virtuals
wasteLogSchema.virtual('ageInHours').get(function() {
  return (Date.now() - this.loggedAt) / (1000 * 60 * 60);
});

wasteLogSchema.virtual('isRecent').get(function() {
  return this.ageInHours <= 24;
});

// Methods
wasteLogSchema.methods.isEditable = function() {
  if (this.isDeleted) return false;
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return this.loggedAt > oneDayAgo;
};

wasteLogSchema.methods.isDeletable = function() {
  if (this.isDeleted) return false;
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return this.loggedAt > oneDayAgo;
};

// Statics
wasteLogSchema.statics.findNearby = function(coordinates, maxDistance = 10000, filters = {}) {
  const query = {
    isDeleted: false,
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates
        },
        $maxDistance: maxDistance
      }
    },
    ...filters
  };

  return this.find(query).populate('clinicId', 'username email');
};

wasteLogSchema.statics.getStatistics = async function(clinicId, startDate, endDate) {
  const match = {
    isDeleted: false,
    ...(clinicId && { clinicId: new mongoose.Types.ObjectId(clinicId) }),
    ...(startDate && endDate && {
      loggedAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    })
  };

  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$category',
        totalVolume: { $sum: '$volumeKg' },
        count: { $sum: 1 },
        avgVolume: { $avg: '$volumeKg' },
        minVolume: { $min: '$volumeKg' },
        maxVolume: { $max: '$volumeKg' }
      }
    }
  ]);

  const monthlyTrends = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          year: { $year: '$loggedAt' },
          month: { $month: '$loggedAt' },
          category: '$category'
        },
        totalVolume: { $sum: '$volumeKg' },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  return { stats, monthlyTrends };
};

wasteLogSchema.statics.validateBulk = function(logs) {
  const errors = [];
  const validLogs = [];

  for (const log of logs) {
    const wasteLog = new this(log);
    const validationError = wasteLog.validateSync();
    
    if (validationError) {
      errors.push({
        index: logs.indexOf(log),
        errors: Object.values(validationError.errors).map(err => err.message)
      });
    } else {
      validLogs.push(wasteLog);
    }
  }

  return { errors, validLogs };
};

const WasteLog = mongoose.model('WasteLog', wasteLogSchema);

export default WasteLog;
