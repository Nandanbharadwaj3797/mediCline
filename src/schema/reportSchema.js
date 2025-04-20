import mongoose from 'mongoose';
import { createSchema } from './baseSchema.js';

const recipientSchema = new mongoose.Schema({
  email: String,
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { _id: false });

const reportFields = {
  type: {
    type: String,
    enum: [
      'waste',
      'pickup',
      'clinic_performance',
      'collector_performance',
      'compliance',
      'audit',
      'financial',
      'environmental_impact'
    ],
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  parameters: {
    startDate: Date,
    endDate: Date,
    clinicId: mongoose.Schema.Types.ObjectId,
    collectorId: mongoose.Schema.Types.ObjectId,
    wasteTypes: [String],
    status: [String],
    region: mongoose.Schema.Types.Mixed,
    aggregation: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
      default: 'monthly'
    },
    filters: mongoose.Schema.Types.Mixed
  },
  format: {
    type: String,
    enum: ['pdf', 'csv', 'excel', 'json'],
    required: true
  },
  data: mongoose.Schema.Types.Mixed,
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'generating', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  schedule: {
    frequency: {
      type: String,
      enum: ['once', 'daily', 'weekly', 'monthly', 'quarterly'],
      default: 'once'
    },
    nextRun: Date,
    lastRun: Date,
    recipients: [recipientSchema],
    retentionDays: {
      type: Number,
      default: 30,
      min: 1,
      max: 365
    }
  },
  fileUrl: String,
  error: {
    code: String,
    message: String,
    details: mongoose.Schema.Types.Mixed
  },
  metadata: {
    pageCount: Number,
    recordCount: Number,
    fileSize: Number,
    generationTime: Number,
    version: String,
    checksum: String
  },
  tags: [String],
  permissions: {
    viewRoles: [{
      type: String,
      enum: ['clinic', 'collector', 'health']
    }],
    viewUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  }
};

const reportSchema = createSchema(reportFields);

// Indexes
reportSchema.index({ type: 1, status: 1 });
reportSchema.index({ 'schedule.nextRun': 1 }, { sparse: true });
reportSchema.index({ tags: 1 });
reportSchema.index({ 'permissions.viewRoles': 1 });
reportSchema.index({ 'permissions.viewUsers': 1 });

// Virtuals
reportSchema.virtual('isScheduled').get(function() {
  return this.schedule && this.schedule.frequency !== 'once';
});

reportSchema.virtual('isDue').get(function() {
  if (!this.isScheduled) return false;
  return this.schedule.nextRun <= new Date();
});

reportSchema.virtual('isExpired').get(function() {
  if (!this.schedule?.retentionDays) return false;
  const expirationDate = new Date(this.createdAt);
  expirationDate.setDate(expirationDate.getDate() + this.schedule.retentionDays);
  return new Date() > expirationDate;
});

// Methods
reportSchema.methods.updateStatus = async function(status, error = null) {
  this.status = status;
  if (error) {
    this.error = {
      code: error.code || 'ERROR',
      message: error.message,
      details: error.details
    };
  }
  
  if (status === 'completed') {
    if (this.isScheduled) {
      this.schedule.lastRun = new Date();
      this.schedule.nextRun = this.calculateNextRun();
    }
    
    // Create notification for recipients
    await this.notifyRecipients();
  }
  
  return this.save();
};

reportSchema.methods.notifyRecipients = async function() {
  if (!this.schedule?.recipients?.length) return;
  
  const notifications = this.schedule.recipients.map(recipient => ({
    type: 'report_ready',
    userId: recipient.userId,
    title: `Report Ready: ${this.title}`,
    message: `Your scheduled report "${this.title}" is now available.`,
    category: 'operational',
    priority: 'low',
    data: {
      reportId: this._id,
      reportType: this.type,
      fileUrl: this.fileUrl
    },
    relatedEntity: {
      type: 'report',
      id: this._id
    }
  }));
  
  return mongoose.model('Notification').insertMany(notifications);
};

// Statics
reportSchema.statics.findDueReports = function() {
  return this.find({
    'schedule.frequency': { $ne: 'once' },
    'schedule.nextRun': { $lte: new Date() },
    status: 'completed',
    isDeleted: false
  });
};

reportSchema.statics.cleanupExpiredReports = async function() {
  const reports = await this.find({
    isDeleted: false,
    'schedule.retentionDays': { $exists: true }
  });
  
  const expiredReports = reports.filter(report => report.isExpired);
  
  return Promise.all(expiredReports.map(report => report.softDelete()));
};

// Helper method to calculate next run based on frequency
reportSchema.methods.calculateNextRun = function() {
  const now = new Date();
  switch (this.schedule.frequency) {
    case 'daily':
      return new Date(now.setDate(now.getDate() + 1));
    case 'weekly':
      return new Date(now.setDate(now.getDate() + 7));
    case 'monthly':
      return new Date(now.setMonth(now.getMonth() + 1));
    case 'quarterly':
      return new Date(now.setMonth(now.getMonth() + 3));
    default:
      return null;
  }
};

const Report = mongoose.model('Report', reportSchema);

export default Report; 