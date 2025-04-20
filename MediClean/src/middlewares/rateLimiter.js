import rateLimit from 'express-rate-limit';

// Base rate limiter settings
const baseConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later'
};

// General API rate limiter
export const apiLimiter = rateLimit({
  ...baseConfig,
  max: 100 // limit each IP to 100 requests per windowMs
});

// Stricter rate limiter for write operations
export const writeOperationsLimiter = rateLimit({
  ...baseConfig,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // limit each IP to 30 write operations per hour
  message: 'Too many write operations from this IP, please try again later'
});

// Rate limiter for bulk operations
export const bulkOperationsLimiter = rateLimit({
  ...baseConfig,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 bulk operations per hour
  message: 'Too many bulk operations from this IP, please try again later'
});

// Rate limiter for statistics and analytics
export const analyticsLimiter = rateLimit({
  ...baseConfig,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // limit each IP to 50 analytics requests per hour
  message: 'Too many analytics requests from this IP, please try again later'
});

// Emergency pickup request rate limiter
export const emergencyLimiter = rateLimit({
  ...baseConfig,
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5, // limit each IP to 5 emergency requests per day
  message: 'Too many emergency requests from this IP, please try again later'
});

export default {
  apiLimiter,
  writeOperationsLimiter,
  bulkOperationsLimiter,
  analyticsLimiter,
  emergencyLimiter
};