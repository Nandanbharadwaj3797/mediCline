import mongoose from 'mongoose';

// Base schema options
const baseSchemaOptions = {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function (doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
};

// Base fields common to all schemas
const baseFields = {
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: {
    type: Date
  },
  auditTrail: [{
    action: {
      type: String,
      enum: ['created', 'updated', 'deleted', 'viewed']
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    changes: mongoose.Schema.Types.Mixed
  }]
};

// Common location schema
const locationSchema = {
  type: {
    type: String,
    enum: ['Point'],
    default: 'Point'
  },
  coordinates: {
    type: [Number],
    required: true,
    validate: {
      validator: function (coords) {
        return Array.isArray(coords) &&
          coords.length === 2 &&
          coords[0] >= -180 &&
          coords[0] <= 180 &&
          coords[1] >= -90 &&
          coords[1] <= 90;
      },
      message: 'Invalid coordinates. Must be [longitude, latitude] with valid ranges'
    }
  }
};

// Base methods to add to schema
const baseMethods = {
  addAuditTrail: function (action, user, changes = {}) {
    if (!this.auditTrail) this.auditTrail = [];
    this.auditTrail.push({
      action,
      performedBy: user._id,
      timestamp: new Date(),
      changes
    });
  },
  softDelete: function (user) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.addAuditTrail('deleted', user);
    return this.save();
  }
};

// Factory to create schemas with base fields + custom fields
export const createSchema = (fields, options = {}) => {
  const schema = new mongoose.Schema({
    ...baseFields,
    ...fields
  }, {
    ...baseSchemaOptions,
    ...options
  });

  // Add methods
  Object.keys(baseMethods).forEach(methodName => {
    schema.methods[methodName] = baseMethods[methodName];
  });

  return schema;
};

// Export location schema separately
export const commonSchemas = {
  location: locationSchema
};

export default {
  createSchema,
  commonSchemas
};
