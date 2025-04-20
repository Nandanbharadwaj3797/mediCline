import mongoose from 'mongoose';
import { ValidationError, NotFoundError, InternalError } from '../utils/errors.js';

class BaseRepository {
  constructor(model, modelName) {
    this.model = model;
    this.modelName = modelName;
  }

  /**
   * Create a new document
   * @param {Object} data - The document data
   * @returns {Promise<Object>} Created document
   */
  async create(data) {
    try {
      const doc = new this.model(data);
      return await doc.save();
    } catch (error) {
      if (error.name === 'ValidationError') {
        throw new ValidationError(`Invalid ${this.modelName} data: ${error.message}`);
      }
      if (error.code === 11000) {
        throw new ValidationError(`${this.modelName} with these details already exists`);
      }
      throw new InternalError(`Error creating ${this.modelName}: ${error.message}`);
    }
  }

  /**
   * Find document by ID
   * @param {string} id - The document ID
   * @returns {Promise<Object>} Found document
   */
  async findById(id) {
    const doc = await this.model.findById(id);
    if (!doc) {
      throw new NotFoundError(`${this.modelName} not found`);
    }
    return doc;
  }

  /**
   * Find documents by IDs
   * @param {Array<string>} ids - Array of document IDs
   * @returns {Promise<Array>} Array of found documents
   */
  async findByIds(ids) {
    return this.model.find({ _id: { $in: ids } });
  }

  /**
   * Check if document exists
   * @param {string} id - The document ID
   * @returns {Promise<boolean>} Whether document exists
   */
  async exists(id) {
    return this.model.exists({ _id: id });
  }

  /**
   * Find documents by criteria
   * @param {Object} criteria - Search criteria
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of documents
   */
  async find(criteria = {}, options = {}) {
    const query = this.model.find(criteria);

    if (options.sort) {
      query.sort(options.sort);
    }

    if (options.limit) {
      query.limit(options.limit);
    }

    if (options.skip) {
      query.skip(options.skip);
    }

    if (options.populate) {
      if (Array.isArray(options.populate)) {
        options.populate.forEach(field => query.populate(field));
      } else {
        query.populate(options.populate);
      }
    }

    if (options.select) {
      query.select(options.select);
    }

    if (options.lean) {
      query.lean();
    }

    return query.exec();
  }

  /**
   * Count documents by criteria
   * @param {Object} criteria - Search criteria
   * @returns {Promise<number>} Document count
   */
  async count(criteria = {}) {
    return this.model.countDocuments(criteria);
  }

  /**
   * Update document by ID
   * @param {string} id - The document ID
   * @param {Object} update - Update data
   * @param {Object} options - Update options
   * @returns {Promise<Object>} Updated document
   */
  async update(id, update, options = {}) {
    const doc = await this.model.findByIdAndUpdate(
      id,
      update,
      { new: true, runValidators: true, ...options }
    );

    if (!doc) {
      throw new NotFoundError(`${this.modelName} not found`);
    }

    return doc;
  }

  /**
   * Delete document by ID
   * @param {string} id - The document ID
   * @returns {Promise<Object>} Deleted document
   */
  async delete(id) {
    const doc = await this.model.findByIdAndDelete(id);
    if (!doc) {
      throw new NotFoundError(`${this.modelName} not found`);
    }
    return doc;
  }

  /**
   * Soft delete document by ID
   * @param {string} id - The document ID
   * @returns {Promise<Object>} Soft deleted document
   */
  async softDelete(id) {
    const doc = await this.update(id, {
      isDeleted: true,
      deletedAt: new Date()
    });
    return doc;
  }

  /**
   * Batch create documents
   * @param {Array<Object>} items - Array of document data
   * @param {Object} options - Insert options
   * @returns {Promise<Array>} Created documents
   */
  async batchCreate(items, options = {}) {
    try {
      return await this.model.insertMany(items, { ordered: false, ...options });
    } catch (error) {
      if (error.name === 'ValidationError') {
        throw new ValidationError(`Invalid ${this.modelName} data in batch: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Batch update documents
   * @param {Array<{id: string, update: Object}>} updates - Array of updates
   * @returns {Promise<Object>} Bulk write result
   */
  async batchUpdate(updates) {
    const bulkOps = updates.map(({ id, update }) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: update }
      }
    }));
    return this.model.bulkWrite(bulkOps);
  }

  /**
   * Get distinct values
   * @param {string} field - Field to get distinct values for
   * @param {Object} criteria - Filter criteria
   * @returns {Promise<Array>} Array of distinct values
   */
  async distinct(field, criteria = {}) {
    return this.model.distinct(field, criteria);
  }

  /**
   * Run aggregation pipeline
   * @param {Array} pipeline - Aggregation pipeline
   * @param {Object} options - Aggregation options
   * @returns {Promise<Array>} Aggregation results
   */
  async aggregate(pipeline, options = {}) {
    return this.model.aggregate(pipeline, options);
  }

  /**
   * Find one document by criteria
   * @param {Object} criteria - Search criteria
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Found document
   */
  async findOne(criteria = {}, options = {}) {
    const query = this.model.findOne(criteria);

    if (options.populate) {
      if (Array.isArray(options.populate)) {
        options.populate.forEach(field => query.populate(field));
      } else {
        query.populate(options.populate);
      }
    }

    if (options.select) {
      query.select(options.select);
    }

    const doc = await query.exec();
    if (!doc && options.throwIfNotFound) {
      throw new NotFoundError(`${this.modelName} not found`);
    }
    return doc;
  }

  /**
   * Update many documents by criteria
   * @param {Object} criteria - Search criteria
   * @param {Object} update - Update data
   * @param {Object} options - Update options
   * @returns {Promise<Object>} Update result
   */
  async updateMany(criteria, update, options = {}) {
    try {
      return await this.model.updateMany(
        criteria,
        update,
        { runValidators: true, ...options }
      );
    } catch (error) {
      if (error.name === 'ValidationError') {
        throw new ValidationError(`Invalid ${this.modelName} update data: ${error.message}`);
      }
      throw new InternalError(`Error updating ${this.modelName}s: ${error.message}`);
    }
  }

  /**
   * Find documents with pagination
   * @param {Object} criteria - Search criteria
   * @param {Object} options - Query options including page and limit
   * @returns {Promise<Object>} Paginated result with docs and metadata
   */
  async findWithPagination(criteria = {}, options = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 10));
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      this.find(criteria, { ...options, skip, limit }),
      this.count(criteria)
    ]);

    return {
      docs,
      metadata: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Restore soft deleted document
   * @param {string} id - The document ID
   * @returns {Promise<Object>} Restored document
   */
  async restore(id) {
    const doc = await this.update(id, {
      isDeleted: false,
      deletedAt: null,
      restoredAt: new Date()
    });
    return doc;
  }
}

export default BaseRepository; 