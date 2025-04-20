import jwt from 'jsonwebtoken';
import { ValidationError } from '../utils/errors.js';


const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'; // Should be in environment variables



export const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const authMiddleware  = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new ValidationError('No authorization token provided');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new ValidationError('Invalid authorization format');
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.id,
      role: decoded.role,
      username: decoded.username,
      email: decoded.email
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(new ValidationError('Invalid token'));
    } else if (error.name === 'TokenExpiredError') {
      next(new ValidationError('Token expired'));
    } else {
      next(error);
    }
  }
};


export const authorize = (allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new ValidationError('User not authenticated');
      }

      if (!allowedRoles.includes(req.user.role)) {
        throw new ValidationError('Unauthorized access');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const checkResourceOwnership = (checkOwnership) => {
  return async (req, res, next) => {
    try {
      const hasAccess = await checkOwnership(req);
      if (!hasAccess) {
        throw new ValidationError('Unauthorized access to resource');
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

