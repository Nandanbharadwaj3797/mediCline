import mongoose from 'mongoose';
import { ValidationError } from './errors.js';

/**
 * Validates if a string is a valid MongoDB ObjectId
 * @param {string} id - The ID to validate
 * @returns {boolean} Whether the ID is valid
 */
export const validateObjectId = (id) => {
    if (!id) return false;
    return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Validates a string's length
 * @param {string} str - The string to validate
 * @param {number} minLength - Minimum length
 * @param {number} maxLength - Maximum length
 * @returns {boolean} Whether the string is valid
 */
export const validateString = (str, minLength = 1, maxLength = Infinity) => {
    if (typeof str !== 'string') return false;
    const length = str.trim().length;
    return length >= minLength && length <= maxLength;
};

/**
 * Validates if a value is one of the allowed values
 * @param {*} value - The value to validate
 * @param {Array} allowedValues - Array of allowed values
 * @returns {boolean} Whether the value is valid
 */
export const validateEnum = (value, allowedValues) => {
    return allowedValues.includes(value);
};

/**
 * Validates if a value is a valid date
 * @param {*} value - The value to validate
 * @returns {boolean} Whether the value is a valid date
 */
export const validateDate = (value) => {
    if (!value) return false;
    const date = new Date(value);
    return date instanceof Date && !isNaN(date);
};

/**
 * Validates if a value is a valid email
 * @param {string} email - The email to validate
 * @returns {boolean} Whether the email is valid
 */
export const validateEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Validates if a value is a valid phone number
 * @param {string} phone - The phone number to validate
 * @returns {boolean} Whether the phone number is valid
 */
export const validatePhone = (phone) => {
    if (!phone || typeof phone !== 'string') return false;
    const phoneRegex = /^\+?[\d\s-]{10,}$/;
    return phoneRegex.test(phone);
};

/**
 * Validates if a value is a valid URL
 * @param {string} url - The URL to validate
 * @returns {boolean} Whether the URL is valid
 */
export const validateUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

/**
 * Validates if a value is a valid password
 * @param {string} password - The password to validate
 * @param {Object} options - Validation options
 * @returns {boolean} Whether the password is valid
 */
export const validatePassword = (password, options = {}) => {
    const {
        minLength = 8,
        requireUppercase = true,
        requireLowercase = true,
        requireNumbers = true,
        requireSpecial = true
    } = options;

    if (!password || typeof password !== 'string') return false;
    if (password.length < minLength) return false;
    
    if (requireUppercase && !/[A-Z]/.test(password)) return false;
    if (requireLowercase && !/[a-z]/.test(password)) return false;
    if (requireNumbers && !/\d/.test(password)) return false;
    if (requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) return false;

    return true;
};

/**
 * Validates if a value is within a numeric range
 * @param {number} value - The value to validate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {boolean} Whether the value is valid
 */
export const validateNumericRange = (value, min = -Infinity, max = Infinity) => {
    if (typeof value !== 'number' || isNaN(value)) return false;
    return value >= min && value <= max;
};

/**
 * Validates if an array has valid length
 * @param {Array} arr - The array to validate
 * @param {number} minLength - Minimum length
 * @param {number} maxLength - Maximum length
 * @returns {boolean} Whether the array is valid
 */
export const validateArrayLength = (arr, minLength = 0, maxLength = Infinity) => {
    if (!Array.isArray(arr)) return false;
    return arr.length >= minLength && arr.length <= maxLength;
};

/**
 * Validates geographical coordinates [longitude, latitude]
 * @param {Array<number>} coordinates - Array of [longitude, latitude]
 * @returns {boolean} - True if valid, false otherwise
 */
export const validateCoordinates = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    return false;
  }

  const [longitude, latitude] = coordinates;

  if (typeof longitude !== 'number' || typeof latitude !== 'number') {
    return false;
  }

  // Validate longitude (-180 to 180)
  if (longitude < -180 || longitude > 180) {
    return false;
  }

  // Validate latitude (-90 to 90)
  if (latitude < -90 || latitude > 90) {
    return false;
  }

  return true;
};

/**
 * Validates pagination parameters
 * @param {Object} params - Pagination parameters
 * @returns {boolean} - True if valid, false otherwise
 */
export const validatePagination = (params) => {
  const { page, limit } = params;

  if (page !== undefined) {
    if (!Number.isInteger(page) || page < 1) {
      return false;
    }
  }

  if (limit !== undefined) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return false;
    }
  }

  return true;
};

/**
 * Validates a number against common criteria
 * @param {number} value - The number to validate
 * @param {Object} options - Validation options
 * @returns {boolean} - True if valid, false otherwise
 */
export const validateNumber = (value, options = {}) => {
  if (typeof value !== 'number' || isNaN(value)) {
    return false;
  }

  if (options.integer && !Number.isInteger(value)) {
    return false;
  }

  if (options.min !== undefined && value < options.min) {
    return false;
  }

  if (options.max !== undefined && value > options.max) {
    return false;
  }

  if (options.positive && value <= 0) {
    return false;
  }

  return true;
}; 