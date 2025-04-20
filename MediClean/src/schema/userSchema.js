import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { createSchema, commonSchemas } from './baseSchema.js';

const phoneRegex = /^\+?[1-9]\d{1,14}$/;

const userFields = {
  username: {
    type: String,
    required: true,
    unique: true,
    minlength: 5,
    trim: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
    validate: {
      validator: function (value) {
        return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(value);
      },
      message: 'Please enter a valid email address'
    }
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false,
    validate: {
      validator: function(passwordValue) {
        return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(passwordValue);
      },
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    }
  },
  phone: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return phoneRegex.test(v);
      },
      message: props => `${props.value} is not a valid phone number!`
    }
  },
  profileImage: {
    type: String,
    default: 'default.png'
  },
  role: {
    type: String,
    enum: ['clinic', 'collector', 'health'],
    required: true,
    index: true
  },
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: {
    type: Date,
    default: null
  },
  lastLoginAt: {
    type: Date,
    default: null
  },
  lastPasswordChange: {
    type: Date,
    default: Date.now
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockoutUntil: {
    type: Date,
    default: null
  },

  // Contact and Address Information
  address: {
    street: { 
      type: String,
      required: true
    },
    city: { 
      type: String,
      required: true
    },
    state: { 
      type: String,
      required: true
    },
    postalCode: { 
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^\d{5}(-\d{4})?$/.test(v);
        },
        message: props => `${props.value} is not a valid postal code!`
      }
    },
    country: { 
      type: String,
      required: true
    },
    location: commonSchemas.location
  },

  // Collector-specific fields
  serviceArea: {
    center: commonSchemas.location,
    radiusKm: {
      type: Number,
      min: [1, 'Service radius must be at least 1 km'],
      max: [100, 'Service radius cannot exceed 100 km'],
      default: 10
    }
  },

  // Clinic-specific fields
  operatingHours: {
    monday: { open: String, close: String },
    tuesday: { open: String, close: String },
    wednesday: { open: String, close: String },
    thursday: { open: String, close: String },
    friday: { open: String, close: String },
    saturday: { open: String, close: String },
    sunday: { open: String, close: String }
  },

  // Notification preferences
  notificationPreferences: {
    type: Map,
    of: {
      type: [String],
      validate: {
        validator: function(channels) {
          return channels.every(channel => 
            ['in_app', 'email', 'sms', 'all'].includes(channel)
          );
        },
        message: 'Invalid notification channel'
      }
    },
    default: new Map([
      ['pickup_request', ['in_app', 'email']],
      ['pickup_assigned', ['in_app', 'email', 'sms']],
      ['pickup_completed', ['in_app', 'email']],
      ['waste_threshold_exceeded', ['in_app', 'email', 'sms']],
      ['system_maintenance', ['in_app']]
    ])
  },
  
  // Compliance and verification
  verificationStatus: {
    isVerified: {
      type: Boolean,
      default: false
    },
    verifiedAt: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    documents: [{
      type: {
        type: String,
        enum: ['license', 'permit', 'certification', 'insurance'],
        required: true
      },
      number: String,
      issuedBy: String,
      issuedDate: Date,
      expiryDate: Date,
      fileUrl: String,
      verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
      }
    }]
  }
};

const userSchema = createSchema(userFields);

// Indexes
userSchema.index({ 'address.location': '2dsphere' });
userSchema.index({ 'serviceArea.center': '2dsphere' });
userSchema.index({ email: 1, username: 1 });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ 'verificationStatus.isVerified': 1, role: 1 });
userSchema.index({ 'verificationStatus.documents.expiryDate': 1 });

// Password hashing middleware
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.lastPasswordChange = new Date();
    next();
  } catch (error) {
    next(error);
  }
});

// Virtuals
userSchema.virtual('displayName').get(function () {
  return this.username || this.email;
});

userSchema.virtual('isLocked').get(function() {
  return this.lockoutUntil && this.lockoutUntil > new Date();
});

// Methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

userSchema.methods.incrementLoginAttempts = async function() {
  this.failedLoginAttempts += 1;
  
  if (this.failedLoginAttempts >= 5) {
    const lockoutDuration = 30 * 60 * 1000; // 30 minutes
    this.lockoutUntil = new Date(Date.now() + lockoutDuration);
  }
  
  return this.save();
};

userSchema.methods.resetLoginAttempts = function() {
  this.failedLoginAttempts = 0;
  this.lockoutUntil = null;
  return this.save();
};

userSchema.methods.updateLoginTimestamp = function() {
  this.lastLoginAt = new Date();
  return this.save();
};

userSchema.methods.addDocument = function(document) {
  if (!this.verificationStatus.documents) {
    this.verificationStatus.documents = [];
  }
  this.verificationStatus.documents.push(document);
  return this.save();
};

userSchema.methods.updateVerificationStatus = async function(isVerified, verifiedBy) {
  this.verificationStatus.isVerified = isVerified;
  if (isVerified) {
    this.verificationStatus.verifiedAt = new Date();
    this.verificationStatus.verifiedBy = verifiedBy;
  }
  return this.save();
};

// Statics
userSchema.statics.findByCredentials = async function(email, password) {
  const user = await this.findOne({ email }).select('+password');
  if (!user) throw new Error('Invalid login credentials');
  
  if (user.isLocked) {
    throw new Error('Account is temporarily locked. Please try again later.');
  }
  
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    await user.incrementLoginAttempts();
    throw new Error('Invalid login credentials');
  }
  
  await user.resetLoginAttempts();
  await user.updateLoginTimestamp();
  
  return user;
};

userSchema.statics.findNearbyCollectors = function(coordinates, maxDistance = 10000) {
  return this.find({
    role: 'collector',
    status: 'active',
    isDeleted: false,
    'verificationStatus.isVerified': true,
    'serviceArea.center': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates
        },
        $maxDistance: maxDistance
      }
    }
  });
};

const User = mongoose.model('User', userSchema);

export default User;
