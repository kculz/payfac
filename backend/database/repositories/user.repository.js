/**
 * User Repository
 * 
 * Handles all database operations related to users.
 * Extends BaseRepository with user-specific methods.
 * 
 * Location: src/database/repositories/userRepository.js
 */

const BaseRepository = require('./base.repository');
const { prisma } = require('../../src/config/database.config');
const { ConflictError, NotFoundError } = require('../../src/shared/utils/ApiError');
const logger = require('../../src/shared/utils/logger');

class UserRepository extends BaseRepository {
  constructor() {
    super('user');
    this.prismaClient = prisma;
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>} User or null
   */
  async findByEmail(email, options = {}) {
    return this.findOne(
      { email: email.toLowerCase() },
      options
    );
  }

  /**
   * Find user by email or throw error
   * @param {string} email - User email
   * @param {Object} options - Query options
   * @returns {Promise<Object>} User
   * @throws {NotFoundError} If user not found
   */
  async findByEmailOrFail(email, options = {}) {
    const user = await this.findByEmail(email, options);
    
    if (!user) {
      throw new NotFoundError('User');
    }

    return user;
  }

  /**
   * Check if email already exists
   * @param {string} email - Email to check
   * @param {string} excludeUserId - User ID to exclude (for updates)
   * @returns {Promise<boolean>} True if email exists
   */
  async emailExists(email, excludeUserId = null) {
    const where = { email: email.toLowerCase() };
    
    if (excludeUserId) {
      where.id = { not: excludeUserId };
    }

    return this.exists(where);
  }

  /**
   * Create a new user with password hashing
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created user (without password)
   */
  async createUser(userData) {
    const { email, password_hash, business_name, phone, role } = userData;

    // Check if email already exists
    const exists = await this.emailExists(email);
    if (exists) {
      throw new ConflictError('Email already registered');
    }

    // Create user
    const user = await this.create({
      email: email.toLowerCase(),
      password_hash,
      business_name,
      phone,
      role: role || 'SELLER',
      status: 'ACTIVE'
    });

    // Create associated account balance
    await this.model.update({
      where: { id: user.id },
      data: {
        account_balance: {
          create: {
            available_balance: 0,
            pending_balance: 0,
            reserved_balance: 0
          }
        }
      }
    });

    logger.info('User created with account balance', {
      userId: user.id,
      email: user.email,
      businessName: user.business_name
    });

    // Return user without password
    return this.sanitizeUser(user);
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated user
   */
  async updateProfile(userId, updateData) {
    const { email, business_name, phone } = updateData;

    // If email is being changed, check for conflicts
    if (email) {
      const exists = await this.emailExists(email, userId);
      if (exists) {
        throw new ConflictError('Email already in use');
      }
    }

    const user = await this.update(userId, {
      ...(email && { email: email.toLowerCase() }),
      ...(business_name && { business_name }),
      ...(phone && { phone })
    });

    return this.sanitizeUser(user);
  }

  /**
   * Update user password
   * @param {string} userId - User ID
   * @param {string} newPasswordHash - New hashed password
   * @returns {Promise<Object>} Updated user
   */
  async updatePassword(userId, newPasswordHash) {
    const user = await this.update(userId, {
      password_hash: newPasswordHash
    });

    logger.security('Password updated', {
      userId: user.id,
      email: user.email
    });

    return this.sanitizeUser(user);
  }

  /**
   * Update user status
   * @param {string} userId - User ID
   * @param {string} status - New status (ACTIVE, SUSPENDED, etc.)
   * @returns {Promise<Object>} Updated user
   */
  async updateStatus(userId, status) {
    const user = await this.update(userId, { status });

    logger.info('User status updated', {
      userId: user.id,
      status
    });

    return this.sanitizeUser(user);
  }

  /**
   * Suspend user account
   * @param {string} userId - User ID
   * @param {string} reason - Suspension reason
   * @returns {Promise<Object>} Updated user
   */
  async suspendUser(userId, reason) {
    const user = await this.update(userId, {
      status: 'SUSPENDED'
    });

    logger.security('User suspended', {
      userId: user.id,
      reason
    });

    return this.sanitizeUser(user);
  }

  /**
   * Activate suspended user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated user
   */
  async activateUser(userId) {
    const user = await this.update(userId, {
      status: 'ACTIVE',
      login_attempts: 0,
      locked_until: null
    });

    logger.info('User activated', {
      userId: user.id
    });

    return this.sanitizeUser(user);
  }

  /**
   * Record login attempt
   * @param {string} userId - User ID
   * @param {boolean} success - Whether login was successful
   * @returns {Promise<Object>} Updated user
   */
  async recordLoginAttempt(userId, success) {
    const user = await this.findByIdOrFail(userId);

    if (success) {
      // Reset login attempts on success
      return this.update(userId, {
        login_attempts: 0,
        locked_until: null,
        last_login: new Date()
      });
    } else {
      // Increment login attempts
      const newAttempts = user.login_attempts + 1;
      const maxAttempts = 5;

      const updateData = {
        login_attempts: newAttempts
      };

      // Lock account after max attempts
      if (newAttempts >= maxAttempts) {
        const lockDuration = 30 * 60 * 1000; // 30 minutes
        updateData.locked_until = new Date(Date.now() + lockDuration);

        logger.security('User account locked', {
          userId: user.id,
          attempts: newAttempts,
          lockedUntil: updateData.locked_until
        });
      }

      return this.update(userId, updateData);
    }
  }

  /**
   * Check if user account is locked
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Lock status and details
   */
  async isAccountLocked(userId) {
    const user = await this.findByIdOrFail(userId);

    if (!user.locked_until) {
      return { locked: false };
    }

    const now = new Date();
    if (now < user.locked_until) {
      const remainingMs = user.locked_until - now;
      const remainingMinutes = Math.ceil(remainingMs / 60000);

      return {
        locked: true,
        until: user.locked_until,
        remainingMinutes
      };
    }

    // Lock has expired, reset attempts
    await this.update(userId, {
      login_attempts: 0,
      locked_until: null
    });

    return { locked: false };
  }

  /**
   * Verify user email
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated user
   */
  async verifyEmail(userId) {
    const user = await this.update(userId, {
      email_verified: true,
      email_verified_at: new Date()
    });

    logger.info('Email verified', {
      userId: user.id,
      email: user.email
    });

    return this.sanitizeUser(user);
  }

  /**
   * Get user with balance
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User with balance information
   */
  async getUserWithBalance(userId) {
    const user = await this.findById(userId, {
      include: {
        account_balance: true
      }
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    return this.sanitizeUser(user);
  }

  /**
   * Get users with pagination and filters
   * @param {Object} filters - Filter criteria
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Paginated users
   */
  async getUsers(filters = {}, pagination = {}) {
    const { status, role, search } = filters;

    const where = {};

    if (status) {
      where.status = status;
    }

    if (role) {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { business_name: { contains: search, mode: 'insensitive' } }
      ];
    }

    return this.paginate(where, {
      ...pagination,
      select: {
        id: true,
        email: true,
        business_name: true,
        phone: true,
        status: true,
        role: true,
        created_at: true,
        last_login: true,
        email_verified: true
      }
    });
  }

  /**
   * Get user statistics
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User statistics
   */
  async getUserStats(userId) {
    const user = await this.getUserWithBalance(userId);

    // Get transaction counts
    const [totalTransactions, totalSales, totalDeposits] = await Promise.all([
      this.model.transaction.count({ where: { user_id: userId } }),
      this.model.transaction.count({
        where: {
          user_id: userId,
          transaction_type: 'SALE',
          status: 'COMPLETED'
        }
      }),
      this.model.transaction.count({
        where: {
          user_id: userId,
          transaction_type: 'DEPOSIT',
          status: 'COMPLETED'
        }
      })
    ]);

    return {
      user: this.sanitizeUser(user),
      stats: {
        totalTransactions,
        totalSales,
        totalDeposits,
        accountAge: Math.floor(
          (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)
        )
      }
    };
  }

  /**
   * Get active sellers count
   * @returns {Promise<number>} Count of active sellers
   */
  async getActiveSellerCount() {
    return this.count({
      status: 'ACTIVE',
      role: 'SELLER'
    });
  }

  /**
   * Get users by status
   * @param {string} status - User status
   * @returns {Promise<Array>} Array of users
   */
  async getUsersByStatus(status) {
    return this.findMany(
      { status },
      {
        select: {
          id: true,
          email: true,
          business_name: true,
          status: true,
          created_at: true
        }
      }
    );
  }

  /**
   * Search users
   * @param {string} query - Search query
   * @param {number} limit - Result limit
   * @returns {Promise<Array>} Array of matching users
   */
  async searchUsers(query, limit = 10) {
    return this.findMany(
      {
        OR: [
          { email: { contains: query, mode: 'insensitive' } },
          { business_name: { contains: query, mode: 'insensitive' } }
        ],
        status: 'ACTIVE'
      },
      {
        take: limit,
        select: {
          id: true,
          email: true,
          business_name: true,
          phone: true
        }
      }
    );
  }

  /**
   * Remove sensitive data from user object
   * @param {Object} user - User object
   * @returns {Object} Sanitized user
   */
  sanitizeUser(user) {
    if (!user) return null;

    const { password_hash, login_attempts, locked_until, ...sanitized } = user;
    return sanitized;
  }

  /**
   * Batch sanitize users
   * @param {Array} users - Array of users
   * @returns {Array} Array of sanitized users
   */
  sanitizeUsers(users) {
    return users.map(user => this.sanitizeUser(user));
  }
}

// Export singleton instance
module.exports = new UserRepository();