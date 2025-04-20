import {
  findByEmail,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  findUsers,
  updatePassword,
  updateNotificationPreferences
} from '../repository/userRepository.js';

import {
  ValidationError,
  NotFoundError,
  InternalError,
  AuthenticationError
} from '../utils/errors.js';

import {
  validateObjectId,
  validateEmail,
  validatePassword
} from '../utils/validation.js';

import {
  hashPassword,
  comparePasswords
} from '../utils/auth.js';

import { createNotification } from './notificationservice.js';

const VALID_ROLES = ['admin', 'clinic', 'collector'];
const VALID_STATUSES = ['active', 'inactive', 'suspended'];

// Find user by email
const getUserByEmail = async (email) => {
  try {
    if (!validateEmail(email)) {
      throw new ValidationError('Invalid email format');
    }

    const user = await findByEmail(email);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) throw error;
    throw new InternalError('Failed to fetch user by email', error);
  }
};

// Register a new user
const registerUser = async (data) => {
  try {
    if (!data.email || !data.password || !data.role) {
      throw new ValidationError('Email, password, and role are required');
    }

    if (!validateEmail(data.email)) {
      throw new ValidationError('Invalid email format');
    }

    if (!validatePassword(data.password)) {
      throw new ValidationError('Password does not meet security requirements');
    }

    if (!VALID_ROLES.includes(data.role)) {
      throw new ValidationError(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
    }

    const existingUser = await findByEmail(data.email);
    if (existingUser) {
      throw new ValidationError('Email already registered');
    }

    const hashedPassword = await hashPassword(data.password);

    const user = await createUser({
      ...data,
      password: hashedPassword,
      status: 'active',
      createdAt: new Date()
    });

    await createNotification({
      userId: user._id,
      type: 'account_update',
      title: 'Welcome to MediClean',
      message: `Your account has been created successfully. Role: ${user.role}`,
      category: 'administrative'
    });

    const { password: _, ...userWithoutPassword } = user.toObject();
    return userWithoutPassword;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new InternalError('Failed to register user', error);
  }
};

// Get user by ID
const fetchUserById = async (id) => {
  try {
    if (!validateObjectId(id)) {
      throw new ValidationError('Invalid user ID');
    }

    const user = await getUserById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) throw error;
    throw new InternalError('Failed to fetch user by ID', error);
  }
};

// Update user profile
const updateUserProfile = async (userId, updates) => {
  try {
    if (!validateObjectId(userId)) {
      throw new ValidationError('Invalid user ID');
    }

    if (updates.email && !validateEmail(updates.email)) {
      throw new ValidationError('Invalid email format');
    }

    if (updates.role && !VALID_ROLES.includes(updates.role)) {
      throw new ValidationError(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
    }

    if (updates.status && !VALID_STATUSES.includes(updates.status)) {
      throw new ValidationError(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    if (updates.email) {
      const existingUser = await findByEmail(updates.email);
      if (existingUser && existingUser._id.toString() !== userId) {
        throw new ValidationError('Email already registered');
      }
    }

    const user = await updateUser(userId, updates);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (updates.status || updates.role) {
      await createNotification({
        userId,
        type: 'account_update',
        title: 'Account Updated',
        message: `Your account has been updated: ${
          updates.status ? `Status: ${updates.status}` : ''
        } ${updates.role ? `Role: ${updates.role}` : ''}`.trim(),
        category: 'administrative',
        priority: 'high'
      });
    }

    return user;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) throw error;
    throw new InternalError('Failed to update user profile', error);
  }
};

// Change password
const changePassword = async (userId, currentPassword, newPassword) => {
  try {
    if (!validateObjectId(userId)) {
      throw new ValidationError('Invalid user ID');
    }

    if (!validatePassword(newPassword)) {
      throw new ValidationError('New password does not meet security requirements');
    }

    const user = await getUserById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isValid = await comparePasswords(currentPassword, user.password);
    if (!isValid) {
      throw new AuthenticationError('Current password is incorrect');
    }

    const hashedPassword = await hashPassword(newPassword);
    await updatePassword(userId, hashedPassword);

    await createNotification({
      userId,
      type: 'account_update',
      title: 'Password Changed',
      message: 'Your password has been changed successfully',
      category: 'administrative',
      priority: 'high'
    });

    return true;
  } catch (error) {
    if (
      error instanceof ValidationError ||
      error instanceof NotFoundError ||
      error instanceof AuthenticationError
    ) {
      throw error;
    }
    throw new InternalError('Failed to change password', error);
  }
};

// Update notification preferences
const updateUserNotificationPreferences = async (userId, preferences) => {
  try {
    if (!validateObjectId(userId)) {
      throw new ValidationError('Invalid user ID');
    }

    const user = await getUserById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!preferences || typeof preferences !== 'object') {
      throw new ValidationError('Invalid preferences format');
    }

    await updateNotificationPreferences(userId, preferences);

    return true;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) throw error;
    throw new InternalError('Failed to update notification preferences', error);
  }
};

// Search users
const searchUsers = async ({
  role = null,
  status = null,
  search = '',
  page = 1,
  limit = 20,
  sortBy = 'createdAt',
  sortOrder = 'desc'
} = {}) => {
  try {
    if (role && !VALID_ROLES.includes(role)) {
      throw new ValidationError(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
    }
    if (status && !VALID_STATUSES.includes(status)) {
      throw new ValidationError(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const filters = {};
    if (role) filters.role = role;
    if (status) filters.status = status;
    if (search) {
      filters.$or = [
        { email: new RegExp(search, 'i') },
        { name: new RegExp(search, 'i') },
        { username: new RegExp(search, 'i') }
      ];
    }

    const options = {
      page,
      limit,
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 }
    };

    const result = await findUsers(filters, options);
    return {
      users: result.users,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        pages: Math.ceil(result.total / result.limit)
      }
    };
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new InternalError('Failed to search users', error);
  }
};

// Delete user account
const deleteUserAccount = async (userId) => {
  try {
    if (!validateObjectId(userId)) {
      throw new ValidationError('Invalid user ID');
    }

    const user = await deleteUser(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    return true;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) throw error;
    throw new InternalError('Failed to delete user account', error);
  }
};

// Update user status (added)
const updateUserStatus = async (userId, status) => {
  try {
    if (!validateObjectId(userId)) {
      throw new ValidationError('Invalid user ID');
    }

    if (!VALID_STATUSES.includes(status)) {
      throw new ValidationError(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const updated = await updateUser(userId, { status });
    if (!updated) {
      throw new NotFoundError('User not found');
    }

    await createNotification({
      userId,
      type: 'account_update',
      title: 'Account Status Updated',
      message: `Your account status was changed to: ${status}`,
      category: 'administrative'
    });

    return updated;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) throw error;
    throw new InternalError('Failed to update user status', error);
  }
};

export {
  getUserByEmail,
  registerUser,
  fetchUserById,
  updateUserProfile,
  changePassword,
  updateUserNotificationPreferences,
  searchUsers,
  deleteUserAccount,
  updateUserStatus
};