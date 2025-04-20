import User from "../schema/userSchema.js";
import { validateEmail, validatePassword, validateUsername, validateRole } from '../validations/userValidation.js';
import bcrypt from 'bcrypt';
import PickupRequest from "../schema/pickupRequestSchema.js";
import { ValidationError, NotFoundError, ConflictError, InternalError } from '../utils/errors.js';

// Cache configuration
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 1000;

const setCacheValue = (key, value) => {
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, { value, timestamp: Date.now() });
};

const getCacheValue = (key) => {
  const cached = cache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return cached.value;
};

const invalidateUserCache = (user, oldEmail = null) => {
  if (user.email) cache.delete(`email:${user.email.toLowerCase()}`);
  if (oldEmail) cache.delete(`email:${oldEmail.toLowerCase()}`);
  for (const key of cache.keys()) {
    if (key.startsWith('search:')) cache.delete(key);
  }
};

class UserRepository {
  async initializeIndexes() {
    try {
      await User.collection.createIndex(
        { email: 1 },
        {
          unique: true,
          collation: { locale: 'en', strength: 2 }
        }
      );
      await User.collection.createIndex({ username: 1 }, { unique: true });
    } catch (err) {
      console.error("Error creating indexes:", err);
      throw new InternalError('Failed to initialize indexes');
    }
  }

  async findByEmail(email) {
    try {
      if (!email) throw new ValidationError('Email is required');
      if (!validateEmail(email)) throw new ValidationError('Invalid email format');

      const normalizedEmail = email.toLowerCase();
      const cacheKey = `email:${normalizedEmail}`;
      const cachedUser = getCacheValue(cacheKey);
      if (cachedUser) return cachedUser;

      const user = await User.findOne({
        email: normalizedEmail,
        isDeleted: { $ne: true }
      }).lean();

      if (user) {
        setCacheValue(cacheKey, user);
        return user;
      }
      return null;
    } catch (err) {
      console.error("Error in findByEmail:", err);
      if (err instanceof ValidationError) throw err;
      throw new InternalError();
    }
  }

  async findByUsername(username) {
    try {
      if (!username) throw new ValidationError('Username is required');

      const user = await User.findOne({
        username,
        isDeleted: { $ne: true }
      }).lean();

      if (!user) throw new NotFoundError('User not found');
      return user;
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof ValidationError) throw err;
      console.error("Error in findByUsername:", err);
      throw new InternalError();
    }
  }

  async createUser(data) {
    try {
      const { email, password, username, role } = data;
      
      // Validate all required fields
      if (!validateEmail(email).isValid) {
        throw new ValidationError(validateEmail(email).message);
      }
      if (!validatePassword(password).isValid) {
        throw new ValidationError(validatePassword(password).message);
      }
      if (!validateUsername(username).isValid) {
        throw new ValidationError(validateUsername(username).message);
      }
      if (!validateRole(role).isValid) {
        throw new ValidationError(validateRole(role).message);
      }

      const normalizedEmail = email.toLowerCase();

      // Check for existing user
      const existingUser = await User.findOne({
        $or: [{ email: normalizedEmail }, { username }],
        isDeleted: { $ne: true }
      });

      if (existingUser) {
        const field = existingUser.email === normalizedEmail ? 'email' : 'username';
        throw new ConflictError(`User with this ${field} already exists`);
      }

      const user = new User({ ...data, email: normalizedEmail });
      const savedUser = await user.save();
      const userObj = savedUser.toObject();
      delete userObj.password;
      return userObj;
    } catch (err) {
      if (err.code === 11000) {
        throw new ConflictError('User with this email or username already exists');
      }
      if (err instanceof ValidationError || err instanceof ConflictError) throw err;
      console.error("Error in createUser:", err);
      throw new InternalError('Failed to create user');
    }
  }

  async getUserById(id) {
    try {
      if (!id) throw new ValidationError('User ID is required');
      const user = await User.findOne({ _id: id, isDeleted: { $ne: true } }).lean();
      if (!user) throw new NotFoundError('User not found');
      return user;
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof ValidationError) throw err;
      console.error("Error in getUserById:", err);
      throw new InternalError();
    }
  }

  async updateUser(id, updateData) {
    try {
      if (!id) throw new ValidationError('User ID is required');
      if (!updateData || Object.keys(updateData).length === 0) {
        throw new ValidationError('Update data is required');
      }

      const existingUser = await User.findById(id);
      if (!existingUser || existingUser.isDeleted) {
        throw new NotFoundError('User not found');
      }

      // Validate fields if they are being updated
      if (updateData.email) {
        if (!validateEmail(updateData.email).isValid) {
          throw new ValidationError(validateEmail(updateData.email).message);
        }
        updateData.email = updateData.email.toLowerCase();

        const emailExists = await User.findOne({
          _id: { $ne: id },
          email: updateData.email,
          isDeleted: { $ne: true }
        });
        if (emailExists) {
          throw new ConflictError('Email already in use');
        }
      }

      if (updateData.password) {
        if (!validatePassword(updateData.password).isValid) {
          throw new ValidationError(validatePassword(updateData.password).message);
        }
      }

      if (updateData.username) {
        if (!validateUsername(updateData.username).isValid) {
          throw new ValidationError(validateUsername(updateData.username).message);
        }

        const usernameExists = await User.findOne({
          _id: { $ne: id },
          username: updateData.username,
          isDeleted: { $ne: true }
        });
        if (usernameExists) {
          throw new ConflictError('Username already in use');
        }
      }

      if (updateData.role) {
        if (!validateRole(updateData.role).isValid) {
          throw new ValidationError(validateRole(updateData.role).message);
        }
      }

      const oldEmail = existingUser.email;
      Object.assign(existingUser, updateData);
      const savedUser = await existingUser.save();
      invalidateUserCache(savedUser, oldEmail);

      const userObj = savedUser.toObject();
      delete userObj.password;
      return userObj;
    } catch (err) {
      if (err instanceof ValidationError || 
          err instanceof NotFoundError || 
          err instanceof ConflictError) {
        throw err;
      }
      console.error("Error in updateUser:", err);
      throw new InternalError('Failed to update user');
    }
  }

  async deleteUser(id) {
    try {
      if (!id) throw new ValidationError('User ID is required');

      const user = await User.findById(id);
      if (!user || user.isDeleted) {
        throw new NotFoundError('User not found');
      }

      if (!user.isDeletable()) {
        throw new ValidationError('User cannot be deleted');
      }

      user.isDeleted = true;
      user.deletedAt = new Date();
      user.isActive = false;
      await user.save();

      invalidateUserCache(user);
      return { success: true, message: 'User deleted successfully' };
    } catch (err) {
      if (err instanceof ValidationError || err instanceof NotFoundError) {
        throw err;
      }
      console.error("Error in deleteUser:", err);
      throw new InternalError('Failed to delete user');
    }
  }

  async searchUsers(searchQuery, filters = {}) {
    try {
      if (!searchQuery) throw new ValidationError('Search query is required');

      const cacheKey = `search:${searchQuery}:${JSON.stringify(filters)}`;
      const cachedResults = getCacheValue(cacheKey);
      if (cachedResults) return cachedResults;

      const query = {
        isDeleted: { $ne: true },
        $or: [
          { username: { $regex: searchQuery, $options: 'i' } },
          { email: { $regex: searchQuery, $options: 'i' } }
        ]
      };

      if (filters.role) query.role = filters.role;
      if (filters.isActive !== undefined) query.isActive = filters.isActive;

      const users = await User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .limit(filters.limit || 10)
        .lean();

      setCacheValue(cacheKey, users);
      return users;
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      console.error("Error in searchUsers:", err);
      throw new InternalError('Failed to search users');
    }
  }

  async listUsers(page = 1, limit = 10, filters = {}) {
    try {
      if (page < 1 || limit < 1) {
        throw new ValidationError('Page and limit must be positive');
      }

      const query = { isDeleted: { $ne: true } };
      if (filters.role) query.role = filters.role;
      if (filters.isActive !== undefined) query.isActive = filters.isActive;

      const skip = (page - 1) * limit;
      const [users, total] = await Promise.all([
        User.find(query)
          .select('-password')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        User.countDocuments(query)
      ]);
      
      return {
        users,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          hasMore: skip + users.length < total
        }
      };
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      console.error("Error in listUsers:", err);
      throw new InternalError('Failed to list users');
    }
  }

  async updateLastLogin(userId) {
    try {
      await User.findByIdAndUpdate(userId, {
        lastLoginAt: new Date()
      });
    } catch (err) {
      console.error("Error updating last login:", err);
    }
  }

  async getUsersByClinicId(clinicId) {
    if (!clinicId) throw new ValidationError('Clinic ID is required');
    return await User.find({ clinicId, isDeleted: false }).select('-password').lean();
  }

  async getCollectorStats(collectorId) {
    try {
      const collector = await User.findOne({
        _id: collectorId,
        role: 'collector',
        isDeleted: false
      });

      if (!collector) {
        throw new NotFoundError('Collector not found');
      }

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const stats = await PickupRequest.aggregate([
        {
          $match: {
            collectorId: collector._id,
            requestedAt: { $gte: thirtyDaysAgo },
            isDeleted: false
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalVolume: { $sum: '$volumeKg' },
            avgResponseTime: {
              $avg: {
                $cond: [
                  { $eq: ['$status', 'collected'] },
                  { $subtract: ['$collectedAt', '$requestedAt'] },
                  null
                ]
              }
            }
          }
        }
      ]);

      const serviceAreaStats = {
        totalArea: 0,
        activeClinics: await User.countDocuments({
          role: 'clinic',
          isActive: true,
          isDeleted: false,
          'address.location': {
            $geoWithin: {
              $geometry: collector.serviceArea
            }
          }
        })
      };

      return { stats, serviceAreaStats };
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      console.error("Error in getCollectorStats:", err);
      throw new InternalError('Failed to get collector statistics');
    }
  }

  async createPasswordResetToken(email) {
    try {
      const user = await User.findOne({ 
        email: email.toLowerCase(),
        isDeleted: false,
        isActive: true
      });
      
      if (!user) {
        throw new NotFoundError('No active user found with this email');
      }

      const resetToken = await bcrypt.genSalt(16);
      const hashedToken = await bcrypt.hash(resetToken, 10);
      
      user.passwordResetToken = hashedToken;
      user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      await user.save();

      return resetToken;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      console.error("Error in createPasswordResetToken:", err);
      throw new InternalError('Failed to create password reset token');
    }
  }

  async resetPassword(token, newPassword) {
    try {
      const user = await User.findOne({
        passwordResetExpires: { $gt: Date.now() }
      });

      if (!user) {
        throw new ValidationError('Token is invalid or has expired');
      }

      const isValidToken = await bcrypt.compare(token, user.passwordResetToken);
      if (!isValidToken) {
        throw new ValidationError('Invalid reset token');
      }

      if (!validatePassword(newPassword).isValid) {
        throw new ValidationError(validatePassword(newPassword).message);
      }

      user.password = newPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      return { message: 'Password reset successful' };
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      console.error("Error in resetPassword:", err);
      throw new InternalError('Failed to reset password');
    }
  }

  async updateServiceArea(collectorId, serviceArea) {
    try {
      const user = await User.findOne({ 
        _id: collectorId,
        role: 'collector',
        isDeleted: false
      });

      if (!user) {
        throw new NotFoundError('Collector not found');
      }

      if (!serviceArea || !serviceArea.coordinates || !serviceArea.type) {
        throw new ValidationError('Invalid service area data');
      }

      user.serviceArea = serviceArea;
      await user.save();

      return user;
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof ValidationError) throw err;
      console.error("Error in updateServiceArea:", err);
      throw new InternalError('Failed to update service area');
    }
  }

  async findCollectorsInArea(coordinates, maxDistance = 10000) {
    try {
      const collectors = await User.findNearbyCollectors(coordinates, maxDistance);
      
      const availableCollectors = await Promise.all(
        collectors.map(async collector => {
          const isInArea = await collector.isInServiceArea(coordinates);
          return isInArea ? collector : null;
        })
      );

      return availableCollectors.filter(Boolean);
    } catch (err) {
      console.error("Error in findCollectorsInArea:", err);
      throw new InternalError('Failed to find collectors in area');
    }
  }
}

// Export a singleton instance
export default new UserRepository();
