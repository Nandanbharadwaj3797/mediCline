// controllers/userController.js
import {
  getUserByEmail,
  registerUser,
  fetchUserById,
  updateUser,
  deleteUserAccount,
  searchUsers,
  updateUserProfile,
  updateUserStatus
} from '../services/userservice.js';

import {
  ValidationError,
  AuthenticationError,
  NotFoundError,
  InternalError
} from '../utils/errors.js';

import { validateEmail, validatePassword } from '../validations/userValidation.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '1d';
const SALT_ROUNDS = 12;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}

// POST /api/auth/register
export const handleRegister = async (req, res, next) => {
  try {
    const { username, email, password, role, phone, address, serviceArea } = req.body;

    if (!username || !email || !password || !role) {
      throw new ValidationError('Missing required fields');
    }

    if (!validateEmail(email)) {
      throw new ValidationError('Invalid email format');
    }

    if (!validatePassword(password)) {
      throw new ValidationError('Password does not meet requirements');
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      throw new ValidationError('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const userData = {
      username,
      email,
      password: hashedPassword,
      role,
      phone,
      address,
      serviceArea: role === 'collector' ? serviceArea : undefined,
      status: 'active',
      createdAt: new Date(),
      lastLogin: null
    };

    const newUser = await registerUser(userData);
    const token = generateToken(newUser);

    res.status(201).json({
      token,
      user: sanitizeUser(newUser)
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
export const handleLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    const user = await getUserByEmail(email);
    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    if (user.status !== 'active') {
      throw new AuthenticationError('Account is not active');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new AuthenticationError('Invalid credentials');
    }

    const token = generateToken(user);

    await updateUser(user._id, { lastLogin: new Date() });

    res.json({
      token,
      user: sanitizeUser(user)
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me
export const handleGetProfile = async (req, res, next) => {
  try {
    const user = await fetchUserById(req.user.id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.json(sanitizeUser(user));
  } catch (err) {
    next(err);
  }
};

// PUT /api/users/:id
export const handleUpdateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    delete updates._id;

    if (updates.email && !validateEmail(updates.email)) {
      throw new ValidationError('Invalid email format');
    }

    if (updates.password) {
      if (!validatePassword(updates.password)) {
        throw new ValidationError('Password does not meet requirements');
      }
      updates.password = await bcrypt.hash(updates.password, SALT_ROUNDS);
    }

    const updated = await updateUser(id, updates);
    if (!updated) {
      throw new NotFoundError('User not found');
    }

    res.json(sanitizeUser(updated));
  } catch (err) {
    next(err);
  }
};

// DELETE /api/users/:id
export const handleDeleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await deleteUserAccount(id);
    if (!result) {
      throw new NotFoundError('User not found');
    }

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// GET /api/users
export const handleGetAllUsers = async (req, res, next) => {
  try {
    const {
      role,
      status,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const users = await searchUsers({
      role,
      status,
      page: Number(page),
      limit: Number(limit),
      sortBy,
      sortOrder
    });

    res.json(users);
  } catch (err) {
    next(err);
  }
};

// GET /api/users/role/:role
export const handleGetUsersByRole = async (req, res, next) => {
  try {
    const { role } = req.params;
    const validRoles = ['admin', 'clinic', 'collector', 'health'];

    if (!validRoles.includes(role)) {
      throw new ValidationError('Invalid role');
    }

    const result = await searchUsers({ role });
    res.json(result.users.map(sanitizeUser));
  } catch (err) {
    next(err);
  }
};

// PATCH /api/users/:id/status
export const handleUpdateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['active', 'inactive', 'suspended'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError('Invalid status');
    }

    const updated = await updateUserStatus(id, status);
    if (!updated) {
      throw new NotFoundError('User not found');
    }

    res.json(sanitizeUser(updated));
  } catch (err) {
    next(err);
  }
};

// Helper Functions

const generateToken = (user) => {
  try {
    return jwt.sign(
      {
        id: user._id,
        role: user.role,
        email: user.email,
        status: user.status,
        version: user.__v || 0
      },
      JWT_SECRET,
      {
        expiresIn: JWT_EXPIRY,
        audience: 'MediClean',
        issuer: 'MediClean-Auth'
      }
    );
  } catch (err) {
    throw new InternalError('Failed to generate authentication token');
  }
};

const sanitizeUser = (user) => {
  if (!user || !user.toObject) {
    throw new InternalError('Invalid user object');
  }

  const {
    password,
    __v,
    resetPasswordToken,
    resetPasswordExpires,
    ...clean
  } = user.toObject();

  return clean;
};