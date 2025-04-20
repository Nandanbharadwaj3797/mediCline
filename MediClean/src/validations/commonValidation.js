// Type checking utilities
export const isString = (value) => typeof value === 'string';
export const isNumber = (value) => typeof value === 'number' && !isNaN(value);
export const isBoolean = (value) => typeof value === 'boolean';
export const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
export const isArray = (value) => Array.isArray(value);
export const isDate = (value) => value instanceof Date && !isNaN(value);
export const isEmpty = (value) => value === undefined || value === null || value === '';

// Common validation result creator
export const createValidationResult = (isValid, message = '') => ({
  isValid,
  message: isValid ? '' : message
});

// Combine multiple validation results
export const combineValidations = (...validations) => {
  for (const validation of validations) {
    if (!validation.isValid) return validation;
  }
  return createValidationResult(true);
};

// String validation
export const validateString = (str, options = {}) => {
  const {
    required = true,
    min,
    max,
    pattern,
    trim = true,
    fieldName = 'Field'
  } = options;

  if (isEmpty(str)) {
    return createValidationResult(!required, `${fieldName} is required`);
  }

  if (!isString(str)) {
    return createValidationResult(false, `${fieldName} must be a string`);
  }

  const value = trim ? str.trim() : str;

  if (min !== undefined && value.length < min) {
    return createValidationResult(false, `${fieldName} must be at least ${min} characters long`);
  }

  if (max !== undefined && value.length > max) {
    return createValidationResult(false, `${fieldName} cannot exceed ${max} characters`);
  }

  if (pattern && !pattern.test(value)) {
    return createValidationResult(false, `${fieldName} format is invalid`);
  }

  return createValidationResult(true);
};

// Number validation
export const validateNumber = (num, options = {}) => {
  const {
    required = true,
    min,
    max,
    integer = false,
    positive = false,
    fieldName = 'Number'
  } = options;

  if (isEmpty(num)) {
    return createValidationResult(!required, `${fieldName} is required`);
  }

  if (!isNumber(num)) {
    return createValidationResult(false, `${fieldName} must be a number`);
  }

  if (integer && !Number.isInteger(num)) {
    return createValidationResult(false, `${fieldName} must be an integer`);
  }

  if (positive && num <= 0) {
    return createValidationResult(false, `${fieldName} must be positive`);
  }

  if (min !== undefined && num < min) {
    return createValidationResult(false, `${fieldName} must be at least ${min}`);
  }

  if (max !== undefined && num > max) {
    return createValidationResult(false, `${fieldName} cannot exceed ${max}`);
  }

  return createValidationResult(true);
};

// Array validation
export const validateArray = (arr, options = {}) => {
  const {
    required = true,
    minLength,
    maxLength,
    elementValidator,
    unique = false,
    fieldName = 'Array'
  } = options;

  if (isEmpty(arr)) {
    return createValidationResult(!required, `${fieldName} is required`);
  }

  if (!isArray(arr)) {
    return createValidationResult(false, `${fieldName} must be an array`);
  }

  if (minLength !== undefined && arr.length < minLength) {
    return createValidationResult(false, `${fieldName} must contain at least ${minLength} elements`);
  }

  if (maxLength !== undefined && arr.length > maxLength) {
    return createValidationResult(false, `${fieldName} cannot contain more than ${maxLength} elements`);
  }

  if (unique && new Set(arr).size !== arr.length) {
    return createValidationResult(false, `${fieldName} must contain unique elements`);
  }

  if (elementValidator) {
    for (let i = 0; i < arr.length; i++) {
      const elementValidation = elementValidator(arr[i]);
      if (!elementValidation.isValid) {
        return createValidationResult(
          false,
          `Invalid element at index ${i}: ${elementValidation.message}`
        );
      }
    }
  }

  return createValidationResult(true);
};

// Object validation
export const validateObject = (obj, schema, options = {}) => {
  const {
    required = true,
    allowUnknown = false,
    fieldName = 'Object'
  } = options;

  if (isEmpty(obj)) {
    return createValidationResult(!required, `${fieldName} is required`);
  }

  if (!isObject(obj)) {
    return createValidationResult(false, `${fieldName} must be an object`);
  }

  // Check for unknown fields
  if (!allowUnknown) {
    const unknownFields = Object.keys(obj).filter(key => !schema[key]);
    if (unknownFields.length > 0) {
      return createValidationResult(
        false,
        `Unknown field(s): ${unknownFields.join(', ')}`
      );
    }
  }

  // Validate each field according to schema
  for (const [key, validator] of Object.entries(schema)) {
    if (obj[key] === undefined) {
      if (validator.required) {
        return createValidationResult(false, `${key} is required`);
      }
      continue;
    }

    const validation = validator.validate(obj[key]);
    if (!validation.isValid) {
      return createValidationResult(false, `${key}: ${validation.message}`);
    }
  }

  return createValidationResult(true);
};

// Enum validation
export const validateEnum = (value, options = {}) => {
  const {
    required = true,
    values,
    caseSensitive = true,
    fieldName = 'Value'
  } = options;

  if (isEmpty(value)) {
    return createValidationResult(!required, `${fieldName} is required`);
  }

  if (!values || !isArray(values)) {
    throw new Error('Enum values must be provided as an array');
  }

  const compareValue = !caseSensitive && isString(value) ? value.toLowerCase() : value;
  const compareValues = !caseSensitive ? values.map(v => isString(v) ? v.toLowerCase() : v) : values;

  if (!compareValues.includes(compareValue)) {
    return createValidationResult(
      false,
      `${fieldName} must be one of: ${values.join(', ')}`
    );
  }

  return createValidationResult(true);
};

// Date validation
export const validateDate = (date, options = {}) => {
  const {
    required = true,
    min,
    max,
    future = false,
    past = false,
    fieldName = 'Date'
  } = options;

  if (isEmpty(date)) {
    return createValidationResult(!required, `${fieldName} is required`);
  }

  const dateObj = date instanceof Date ? date : new Date(date);
  if (isNaN(dateObj.getTime())) {
    return createValidationResult(false, `Invalid ${fieldName.toLowerCase()}`);
  }

  const now = new Date();
  if (future && dateObj <= now) {
    return createValidationResult(false, `${fieldName} must be in the future`);
  }

  if (past && dateObj >= now) {
    return createValidationResult(false, `${fieldName} must be in the past`);
  }

  if (min && dateObj < new Date(min)) {
    return createValidationResult(false, `${fieldName} must be after ${new Date(min).toLocaleDateString()}`);
  }

  if (max && dateObj > new Date(max)) {
    return createValidationResult(false, `${fieldName} must be before ${new Date(max).toLocaleDateString()}`);
  }

  return createValidationResult(true);
};

// Phone number validation with international support
export const validatePhoneNumber = (phone, options = {}) => {
  const {
    required = true,
    allowInternational = true,
    fieldName = 'Phone number'
  } = options;

  if (isEmpty(phone)) {
    return createValidationResult(!required, `${fieldName} is required`);
  }

  if (!isString(phone)) {
    return createValidationResult(false, `${fieldName} must be a string`);
  }

  const phoneRegex = allowInternational
    ? /^\+?[\d\s-]{10,}$/
    : /^[\d\s-]{10,}$/;

  if (!phoneRegex.test(phone)) {
    return createValidationResult(
      false,
      allowInternational
        ? 'Invalid phone number format. Must be at least 10 digits with optional + prefix'
        : 'Invalid phone number format. Must be at least 10 digits'
    );
  }

  return createValidationResult(true);
};

// URL validation with options
export const validateUrl = (url, options = {}) => {
  const {
    required = true,
    protocols = ['http:', 'https:'],
    fieldName = 'URL'
  } = options;

  if (isEmpty(url)) {
    return createValidationResult(!required, `${fieldName} is required`);
  }

  try {
    const urlObj = new URL(url);
    if (!protocols.includes(urlObj.protocol)) {
      return createValidationResult(
        false,
        `${fieldName} must use one of these protocols: ${protocols.join(', ')}`
      );
    }
    return createValidationResult(true);
  } catch {
    return createValidationResult(false, `Invalid ${fieldName.toLowerCase()} format`);
  }
}; 