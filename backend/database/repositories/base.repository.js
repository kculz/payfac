/**
 * Base Repository
 * 
 * Abstract base class for all repositories providing common CRUD operations.
 * All specific repositories (User, Transaction, etc.) should extend this class.
 * 
 * Location: src/database/repositories/baseRepository.js
 */

const { prisma } = require('../../src/config/database.config');
const logger = require('../../src/shared/utils/logger');
const { DatabaseError, NotFoundError } = require('../../src/shared/utils/ApiError');

class BaseRepository {
  /**
   * @param {string} modelName - Name of the Prisma model (e.g., 'user', 'transaction')
   */
  constructor(modelName) {
    if (!modelName) {
      throw new Error('Model name is required for repository');
    }

    this.modelName = modelName;
    this.model = prisma[modelName];

    if (!this.model) {
      throw new Error(`Model '${modelName}' does not exist in Prisma schema`);
    }
  }

  /**
   * Find a single record by ID
   * @param {string} id - Record ID
   * @param {Object} options - Query options (include, select, etc.)
   * @returns {Promise<Object|null>} Record or null if not found
   */
  async findById(id, options = {}) {
    try {
      const record = await this.model.findUnique({
        where: { id },
        ...options
      });

      return record;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'findById',
        model: this.modelName,
        id
      });
      throw new DatabaseError(`Failed to find ${this.modelName} by ID`, error.message);
    }
  }

  /**
   * Find a single record by ID or throw error if not found
   * @param {string} id - Record ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Record
   * @throws {NotFoundError} If record not found
   */
  async findByIdOrFail(id, options = {}) {
    const record = await this.findById(id, options);

    if (!record) {
      throw new NotFoundError(this.modelName);
    }

    return record;
  }

  /**
   * Find a single record by any criteria
   * @param {Object} where - Where clause
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>} Record or null
   */
  async findOne(where, options = {}) {
    try {
      const record = await this.model.findFirst({
        where,
        ...options
      });

      return record;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'findOne',
        model: this.modelName,
        where
      });
      throw new DatabaseError(`Failed to find ${this.modelName}`, error.message);
    }
  }

  /**
   * Find a single record or throw error if not found
   * @param {Object} where - Where clause
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Record
   * @throws {NotFoundError} If record not found
   */
  async findOneOrFail(where, options = {}) {
    const record = await this.findOne(where, options);

    if (!record) {
      throw new NotFoundError(this.modelName);
    }

    return record;
  }

  /**
   * Find multiple records
   * @param {Object} where - Where clause
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of records
   */
  async findMany(where = {}, options = {}) {
    try {
      const records = await this.model.findMany({
        where,
        ...options
      });

      return records;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'findMany',
        model: this.modelName,
        where
      });
      throw new DatabaseError(`Failed to find ${this.modelName} records`, error.message);
    }
  }

  /**
   * Find records with pagination
   * @param {Object} where - Where clause
   * @param {Object} options - Pagination and query options
   * @returns {Promise<Object>} Paginated results with metadata
   */
  async paginate(where = {}, options = {}) {
    const {
      page = 1,
      limit = 20,
      orderBy = { created_at: 'desc' },
      include,
      select
    } = options;

    const skip = (page - 1) * limit;

    try {
      const [data, total] = await Promise.all([
        this.model.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          ...(include && { include }),
          ...(select && { select })
        }),
        this.model.count({ where })
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'paginate',
        model: this.modelName,
        page,
        limit
      });
      throw new DatabaseError(`Failed to paginate ${this.modelName} records`, error.message);
    }
  }

  /**
   * Create a new record
   * @param {Object} data - Record data
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Created record
   */
  async create(data, options = {}) {
    try {
      const record = await this.model.create({
        data,
        ...options
      });

      logger.info(`${this.modelName} created`, {
        id: record.id,
        model: this.modelName
      });

      return record;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'create',
        model: this.modelName,
        data: logger.sanitize(data)
      });
      throw new DatabaseError(`Failed to create ${this.modelName}`, error.message);
    }
  }

  /**
   * Create multiple records
   * @param {Array<Object>} dataArray - Array of record data
   * @returns {Promise<Object>} Result with count
   */
  async createMany(dataArray) {
    try {
      const result = await this.model.createMany({
        data: dataArray,
        skipDuplicates: true
      });

      logger.info(`${this.modelName} records created`, {
        count: result.count,
        model: this.modelName
      });

      return result;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'createMany',
        model: this.modelName,
        count: dataArray.length
      });
      throw new DatabaseError(`Failed to create multiple ${this.modelName} records`, error.message);
    }
  }

  /**
   * Update a record by ID
   * @param {string} id - Record ID
   * @param {Object} data - Update data
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Updated record
   */
  async update(id, data, options = {}) {
    try {
      const record = await this.model.update({
        where: { id },
        data: {
          ...data,
          updated_at: new Date()
        },
        ...options
      });

      logger.info(`${this.modelName} updated`, {
        id: record.id,
        model: this.modelName
      });

      return record;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundError(this.modelName);
      }

      logger.errorWithContext(error, {
        method: 'update',
        model: this.modelName,
        id,
        data: logger.sanitize(data)
      });
      throw new DatabaseError(`Failed to update ${this.modelName}`, error.message);
    }
  }

  /**
   * Update multiple records
   * @param {Object} where - Where clause
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Result with count
   */
  async updateMany(where, data) {
    try {
      const result = await this.model.updateMany({
        where,
        data: {
          ...data,
          updated_at: new Date()
        }
      });

      logger.info(`${this.modelName} records updated`, {
        count: result.count,
        model: this.modelName
      });

      return result;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'updateMany',
        model: this.modelName,
        where
      });
      throw new DatabaseError(`Failed to update multiple ${this.modelName} records`, error.message);
    }
  }

  /**
   * Upsert (update or create) a record
   * @param {Object} where - Where clause (unique identifier)
   * @param {Object} updateData - Data to update if exists
   * @param {Object} createData - Data to create if not exists
   * @returns {Promise<Object>} Upserted record
   */
  async upsert(where, updateData, createData) {
    try {
      const record = await this.model.upsert({
        where,
        update: {
          ...updateData,
          updated_at: new Date()
        },
        create: createData
      });

      logger.info(`${this.modelName} upserted`, {
        id: record.id,
        model: this.modelName
      });

      return record;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'upsert',
        model: this.modelName,
        where
      });
      throw new DatabaseError(`Failed to upsert ${this.modelName}`, error.message);
    }
  }

  /**
   * Delete a record by ID
   * @param {string} id - Record ID
   * @returns {Promise<Object>} Deleted record
   */
  async delete(id) {
    try {
      const record = await this.model.delete({
        where: { id }
      });

      logger.info(`${this.modelName} deleted`, {
        id: record.id,
        model: this.modelName
      });

      return record;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundError(this.modelName);
      }

      logger.errorWithContext(error, {
        method: 'delete',
        model: this.modelName,
        id
      });
      throw new DatabaseError(`Failed to delete ${this.modelName}`, error.message);
    }
  }

  /**
   * Delete multiple records
   * @param {Object} where - Where clause
   * @returns {Promise<Object>} Result with count
   */
  async deleteMany(where) {
    try {
      const result = await this.model.deleteMany({
        where
      });

      logger.info(`${this.modelName} records deleted`, {
        count: result.count,
        model: this.modelName
      });

      return result;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'deleteMany',
        model: this.modelName,
        where
      });
      throw new DatabaseError(`Failed to delete multiple ${this.modelName} records`, error.message);
    }
  }

  /**
   * Count records
   * @param {Object} where - Where clause
   * @returns {Promise<number>} Count
   */
  async count(where = {}) {
    try {
      const count = await this.model.count({ where });
      return count;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'count',
        model: this.modelName,
        where
      });
      throw new DatabaseError(`Failed to count ${this.modelName} records`, error.message);
    }
  }

  /**
   * Check if record exists
   * @param {Object} where - Where clause
   * @returns {Promise<boolean>} True if exists
   */
  async exists(where) {
    try {
      const count = await this.count(where);
      return count > 0;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'exists',
        model: this.modelName,
        where
      });
      throw new DatabaseError(`Failed to check ${this.modelName} existence`, error.message);
    }
  }

  /**
   * Perform aggregation
   * @param {Object} options - Aggregation options
   * @returns {Promise<Object>} Aggregation result
   */
  async aggregate(options) {
    try {
      const result = await this.model.aggregate(options);
      return result;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'aggregate',
        model: this.modelName,
        options
      });
      throw new DatabaseError(`Failed to aggregate ${this.modelName}`, error.message);
    }
  }

  /**
   * Group records
   * @param {Object} options - Group by options
   * @returns {Promise<Array>} Grouped results
   */
  async groupBy(options) {
    try {
      const result = await this.model.groupBy(options);
      return result;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'groupBy',
        model: this.modelName,
        options
      });
      throw new DatabaseError(`Failed to group ${this.modelName}`, error.message);
    }
  }

  /**
   * Execute raw SQL query
   * @param {string} query - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<*>} Query result
   */
  async raw(query, params = []) {
    try {
      const result = await prisma.$queryRawUnsafe(query, ...params);
      return result;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'raw',
        model: this.modelName,
        query: query.substring(0, 100)
      });
      throw new DatabaseError('Raw query failed', error.message);
    }
  }

  /**
   * Execute a transaction
   * Wraps Prisma transaction with error handling
   * @param {Function} callback - Transaction callback
   * @returns {Promise<*>} Transaction result
   */
  async transaction(callback) {
    try {
      const result = await prisma.$transaction(callback);
      return result;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'transaction',
        model: this.modelName
      });
      throw new DatabaseError('Transaction failed', error.message);
    }
  }

  /**
   * Soft delete (requires deleted_at field in model)
   * Updates deleted_at timestamp instead of hard delete
   * @param {string} id - Record ID
   * @returns {Promise<Object>} Updated record
   */
  async softDelete(id) {
    try {
      const record = await this.update(id, {
        deleted_at: new Date()
      });

      logger.info(`${this.modelName} soft deleted`, {
        id: record.id,
        model: this.modelName
      });

      return record;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'softDelete',
        model: this.modelName,
        id
      });
      throw new DatabaseError(`Failed to soft delete ${this.modelName}`, error.message);
    }
  }

  /**
   * Restore soft deleted record
   * @param {string} id - Record ID
   * @returns {Promise<Object>} Restored record
   */
  async restore(id) {
    try {
      const record = await this.update(id, {
        deleted_at: null
      });

      logger.info(`${this.modelName} restored`, {
        id: record.id,
        model: this.modelName
      });

      return record;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'restore',
        model: this.modelName,
        id
      });
      throw new DatabaseError(`Failed to restore ${this.modelName}`, error.message);
    }
  }

  /**
   * Find records excluding soft deleted
   * @param {Object} where - Where clause
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of records
   */
  async findManyActive(where = {}, options = {}) {
    return this.findMany(
      {
        ...where,
        deleted_at: null
      },
      options
    );
  }

  /**
   * Batch operation helper
   * Processes array of operations in batches to avoid overwhelming database
   * @param {Array} items - Items to process
   * @param {Function} operation - Operation to perform on each item
   * @param {number} batchSize - Size of each batch
   * @returns {Promise<Array>} Array of results
   */
  async batchOperation(items, operation, batchSize = 100) {
    const results = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      try {
        const batchResults = await Promise.all(
          batch.map(item => operation(item))
        );
        results.push(...batchResults);
        
        logger.info(`Processed batch ${Math.floor(i / batchSize) + 1}`, {
          model: this.modelName,
          processed: Math.min(i + batchSize, items.length),
          total: items.length
        });
      } catch (error) {
        logger.errorWithContext(error, {
          method: 'batchOperation',
          model: this.modelName,
          batchIndex: Math.floor(i / batchSize)
        });
        throw error;
      }
    }

    return results;
  }
}

module.exports = BaseRepository;