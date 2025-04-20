// middleware/authMiddleware.js
import jwt from 'jsonwebtoken';
import { ValidationError } from '../utils/errors.js';

// Constants
const TOKEN_EXPIRY_WARNING = 5 * 60; // 5 minutes in seconds
const BEARER_PREFIX = 'Bearer ';

// Helper function to validate JWT token
const validateToken = (token, secret) => {
  try {
    return jwt.verify(token, secret);
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      throw new ValidationError('Invalid token');
    }
    if (err.name === 'TokenExpiredError') {
      throw new ValidationError('Token has expired');
    }
    throw new ValidationError('Authentication failed');
  }
};

// Helper function to check token expiration
const checkTokenExpiration = (decoded) => {
  const expiryTime = decoded.exp * 1000; // Convert to milliseconds
  const currentTime = Date.now();
  const timeToExpiry = expiryTime - currentTime;

  return timeToExpiry <= TOKEN_EXPIRY_WARNING * 1000;
};

// Main authentication middleware
export const authMiddleware = (roles = []) => {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;

    try {
      // Check for auth header
      if (!authHeader?.startsWith(BEARER_PREFIX)) {
        throw new ValidationError('No token provided');
      }

      // Check for JWT secret
      if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is not defined');
        return res.status(500).json({ 
          error: 'Internal server error',
          details: 'Authentication configuration error'
        });
      }

      // Extract and validate token
      const token = authHeader.substring(BEARER_PREFIX.length);
      if (!token) {
        throw new ValidationError('Invalid token format');
      }

      // Verify token
      const decoded = validateToken(token, process.env.JWT_SECRET);

      // Check role authorization
      if (roles.length > 0 && !roles.includes(decoded.role)) {
        throw new ValidationError(`Access denied: ${decoded.role} role not authorized for this operation`);
      }

      // Check token expiration
      const isNearExpiry = checkTokenExpiration(decoded);
      
      // Attach user info to request
      req.user = {
        ...decoded,
        token,
        isNearExpiry
      };

      // Add warning header if token is near expiry
      if (isNearExpiry) {
        res.set('X-Token-Expiry-Warning', 'true');
      }

      next();
    } catch (err) {
      console.error('Auth Middleware Error:', {
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });

      return res.status(err instanceof ValidationError ? 401 : 500).json({
        error: err.message,
        code: err instanceof ValidationError ? 'AUTH_ERROR' : 'INTERNAL_ERROR'
      });
    }
  };
};

// Role-specific middleware shortcuts
export const clinicOnly = authMiddleware(['clinic']);
export const collectorOnly = authMiddleware(['collector']);
export const healthOnly = authMiddleware(['health']);
export const adminOnly = authMiddleware(['admin']);
export const clinicOrCollector = authMiddleware(['clinic', 'collector']);
export const clinicOrHealth = authMiddleware(['clinic', 'health']);

// Optional auth middleware - allows authenticated and unauthenticated access
export const optionalAuth = () => {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith(BEARER_PREFIX)) {
      req.user = null;
      return next();
    }

    try {
      const token = authHeader.substring(BEARER_PREFIX.length);
      const decoded = validateToken(token, process.env.JWT_SECRET);
      const isNearExpiry = checkTokenExpiration(decoded);

      req.user = {
        ...decoded,
        token,
        isNearExpiry
      };

      if (isNearExpiry) {
        res.set('X-Token-Expiry-Warning', 'true');
      }
    } catch (err) {
      req.user = null;
    }

    next();
  };
};