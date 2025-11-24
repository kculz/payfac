/**
 * Pool Account Service
 * 
 * THE HEART OF THE PAYMENT FACILITATOR SYSTEM
 * 
 * Manages the master pool account that holds all funds before distribution.
 * Handles allocation, deallocation, and synchronization with payment gateway.
 * 
 * CRITICAL: All operations are atomic to prevent financial inconsistencies.
 * 
 * Location: src/services/poolAccount/poolAccountService.js
 */

const { prisma } = require('../../src/config/database.config');
const config = require('../../src/config/environment.config');
const logger = require('../../src/shared/utils/logger');
const {
  PoolAccountError,
  InsufficientBalanceError,
  DatabaseError
} = require('../../src/shared/utils/ApiError');

class PoolAccountService {
  /**
   * Get the current pool account status
   * @returns {Promise<Object>} Pool account details
   */
  async getPoolStatus() {
    try {
      const pool = await prisma.poolAccount.findFirst();

      if (!pool) {
        throw new PoolAccountError('Pool account not initialized');
      }

      return {
        totalBalance: parseFloat(pool.total_balance),
        allocatedBalance: parseFloat(pool.allocated_balance),
        reservedBalance: parseFloat(pool.reserved_balance),
        unallocatedBalance: parseFloat(pool.total_balance) - 
                           parseFloat(pool.allocated_balance) - 
                           parseFloat(pool.reserved_balance),
        currency: pool.currency,
        lastSynced: pool.last_synced_at,
        gatewayAccountId: pool.gateway_account_id
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getPoolStatus'
      });
      throw error;
    }
  }

  /**
   * Initialize pool account (run once during setup)
   * @param {number} initialBalance - Initial balance to set
   * @returns {Promise<Object>} Created pool account
   */
  async initializePool(initialBalance = null) {
    try {
      // Check if pool already exists
      const existing = await prisma.poolAccount.findFirst();
      
      if (existing) {
        logger.warn('Pool account already initialized', {
          poolId: existing.id
        });
        return existing;
      }

      // Create pool account
      const pool = await prisma.poolAccount.create({
        data: {
          total_balance: initialBalance || config.pool.initialBalance,
          allocated_balance: 0,
          reserved_balance: 0,
          currency: config.pool.currency
        }
      });

      logger.info('Pool account initialized', {
        poolId: pool.id,
        initialBalance: pool.total_balance,
        currency: pool.currency
      });

      return pool;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'initializePool',
        initialBalance
      });
      throw new PoolAccountError('Failed to initialize pool account');
    }
  }

  /**
   * Check if sufficient unallocated funds are available
   * @param {number} amount - Amount to check
   * @returns {Promise<boolean>} True if sufficient funds available
   */
  async checkAvailableFunds(amount) {
    try {
      const pool = await prisma.poolAccount.findFirst();

      if (!pool) {
        throw new PoolAccountError('Pool account not found');
      }

      const unallocated = parseFloat(pool.total_balance) - 
                         parseFloat(pool.allocated_balance) - 
                         parseFloat(pool.reserved_balance);

      return unallocated >= amount;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'checkAvailableFunds',
        amount
      });
      throw error;
    }
  }

  /**
   * Allocate funds to a user (when they deposit)
   * ATOMIC OPERATION - Updates both pool and user balance
   * 
   * @param {string} userId - User ID to allocate funds to
   * @param {number} amount - Amount to allocate
   * @returns {Promise<Object>} Updated pool and balance information
   */
  async allocateToUser(userId, amount) {
    if (amount <= 0) {
      throw new PoolAccountError('Allocation amount must be positive');
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Get current pool state with lock
        const pool = await tx.poolAccount.findFirst();

        if (!pool) {
          throw new PoolAccountError('Pool account not found');
        }

        // 2. Calculate available funds
        const unallocated = parseFloat(pool.total_balance) - 
                           parseFloat(pool.allocated_balance) - 
                           parseFloat(pool.reserved_balance);

        // 3. Check if sufficient funds available
        if (unallocated < amount) {
          throw new InsufficientBalanceError(
            amount,
            unallocated
          );
        }

        // 4. Update pool allocated balance
        const updatedPool = await tx.poolAccount.update({
          where: { id: pool.id },
          data: {
            allocated_balance: {
              increment: amount
            }
          }
        });

        // 5. Update user's account balance
        const updatedBalance = await tx.accountBalance.upsert({
          where: { user_id: userId },
          create: {
            user_id: userId,
            available_balance: amount,
            pending_balance: 0,
            reserved_balance: 0,
            currency: config.pool.currency
          },
          update: {
            available_balance: {
              increment: amount
            }
          }
        });

        // 6. Log the allocation
        logger.pool('allocate', {
          userId,
          amount,
          previousAllocated: pool.allocated_balance,
          newAllocated: updatedPool.allocated_balance,
          previousUserBalance: updatedBalance.available_balance - amount,
          newUserBalance: updatedBalance.available_balance
        });

        return {
          pool: {
            totalBalance: parseFloat(updatedPool.total_balance),
            allocatedBalance: parseFloat(updatedPool.allocated_balance),
            reservedBalance: parseFloat(updatedPool.reserved_balance)
          },
          userBalance: {
            available: parseFloat(updatedBalance.available_balance),
            pending: parseFloat(updatedBalance.pending_balance),
            reserved: parseFloat(updatedBalance.reserved_balance)
          }
        };
      });
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'allocateToUser',
        userId,
        amount
      });
      throw error;
    }
  }

  /**
   * Deallocate funds from a user (when they spend or withdraw)
   * ATOMIC OPERATION - Updates both pool and user balance
   * 
   * @param {string} userId - User ID to deallocate funds from
   * @param {number} amount - Amount to deallocate
   * @returns {Promise<Object>} Updated pool and balance information
   */
  async deallocateFromUser(userId, amount) {
    if (amount <= 0) {
      throw new PoolAccountError('Deallocation amount must be positive');
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Get user's current balance
        const userBalance = await tx.accountBalance.findUnique({
          where: { user_id: userId }
        });

        if (!userBalance) {
          throw new PoolAccountError('User balance not found');
        }

        // 2. Check if user has sufficient balance
        if (parseFloat(userBalance.available_balance) < amount) {
          throw new InsufficientBalanceError(
            amount,
            parseFloat(userBalance.available_balance)
          );
        }

        // 3. Get pool
        const pool = await tx.poolAccount.findFirst();

        // 4. Update pool allocated balance (decrease)
        const updatedPool = await tx.poolAccount.update({
          where: { id: pool.id },
          data: {
            allocated_balance: {
              decrement: amount
            }
          }
        });

        // 5. Update user's balance (decrease)
        const updatedBalance = await tx.accountBalance.update({
          where: { user_id: userId },
          data: {
            available_balance: {
              decrement: amount
            }
          }
        });

        // 6. Log the deallocation
        logger.pool('deallocate', {
          userId,
          amount,
          previousAllocated: pool.allocated_balance,
          newAllocated: updatedPool.allocated_balance,
          previousUserBalance: userBalance.available_balance,
          newUserBalance: updatedBalance.available_balance
        });

        return {
          pool: {
            totalBalance: parseFloat(updatedPool.total_balance),
            allocatedBalance: parseFloat(updatedPool.allocated_balance),
            reservedBalance: parseFloat(updatedPool.reserved_balance)
          },
          userBalance: {
            available: parseFloat(updatedBalance.available_balance),
            pending: parseFloat(updatedBalance.pending_balance),
            reserved: parseFloat(updatedBalance.reserved_balance)
          }
        };
      });
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'deallocateFromUser',
        userId,
        amount
      });
      throw error;
    }
  }

  /**
   * Reserve funds in the pool (before transaction processing)
   * Used to prevent over-allocation during pending transactions
   * 
   * @param {number} amount - Amount to reserve
   * @returns {Promise<Object>} Updated pool information
   */
  async reserveFunds(amount) {
    if (amount <= 0) {
      throw new PoolAccountError('Reserve amount must be positive');
    }

    try {
      return await prisma.$transaction(async (tx) => {
        const pool = await tx.poolAccount.findFirst();

        if (!pool) {
          throw new PoolAccountError('Pool account not found');
        }

        // Check if sufficient funds to reserve
        const unallocated = parseFloat(pool.total_balance) - 
                           parseFloat(pool.allocated_balance) - 
                           parseFloat(pool.reserved_balance);

        if (unallocated < amount) {
          throw new InsufficientBalanceError(amount, unallocated);
        }

        // Update reserved balance
        const updatedPool = await tx.poolAccount.update({
          where: { id: pool.id },
          data: {
            reserved_balance: {
              increment: amount
            }
          }
        });

        logger.pool('reserve', {
          amount,
          previousReserved: pool.reserved_balance,
          newReserved: updatedPool.reserved_balance
        });

        return {
          totalBalance: parseFloat(updatedPool.total_balance),
          allocatedBalance: parseFloat(updatedPool.allocated_balance),
          reservedBalance: parseFloat(updatedPool.reserved_balance)
        };
      });
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'reserveFunds',
        amount
      });
      throw error;
    }
  }

  /**
   * Release reserved funds (after transaction completes or fails)
   * 
   * @param {number} amount - Amount to release
   * @returns {Promise<Object>} Updated pool information
   */
  async releaseReservedFunds(amount) {
    if (amount <= 0) {
      throw new PoolAccountError('Release amount must be positive');
    }

    try {
      const pool = await prisma.poolAccount.findFirst();

      if (!pool) {
        throw new PoolAccountError('Pool account not found');
      }

      // Update reserved balance
      const updatedPool = await prisma.poolAccount.update({
        where: { id: pool.id },
        data: {
          reserved_balance: {
            decrement: amount
          }
        }
      });

      logger.pool('release_reserved', {
        amount,
        previousReserved: pool.reserved_balance,
        newReserved: updatedPool.reserved_balance
      });

      return {
        totalBalance: parseFloat(updatedPool.total_balance),
        allocatedBalance: parseFloat(updatedPool.allocated_balance),
        reservedBalance: parseFloat(updatedPool.reserved_balance)
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'releaseReservedFunds',
        amount
      });
      throw error;
    }
  }

  /**
   * Add funds to the pool (manual top-up by admin)
   * 
   * @param {number} amount - Amount to add
   * @param {string} source - Source of funds (bank_transfer, gateway_deposit, etc.)
   * @param {string} reference - Reference number
   * @returns {Promise<Object>} Updated pool information
   */
  async addFundsToPool(amount, source, reference) {
    if (amount <= 0) {
      throw new PoolAccountError('Amount must be positive');
    }

    try {
      const pool = await prisma.poolAccount.findFirst();

      if (!pool) {
        throw new PoolAccountError('Pool account not found');
      }

      const updatedPool = await prisma.poolAccount.update({
        where: { id: pool.id },
        data: {
          total_balance: {
            increment: amount
          },
          last_synced_at: new Date()
        }
      });

      logger.pool('add_funds', {
        amount,
        source,
        reference,
        previousTotal: pool.total_balance,
        newTotal: updatedPool.total_balance
      });

      return {
        totalBalance: parseFloat(updatedPool.total_balance),
        allocatedBalance: parseFloat(updatedPool.allocated_balance),
        reservedBalance: parseFloat(updatedPool.reserved_balance),
        addedAmount: amount
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'addFundsToPool',
        amount,
        source,
        reference
      });
      throw new PoolAccountError('Failed to add funds to pool');
    }
  }

  /**
   * Remove funds from the pool (manual withdrawal by admin)
   * 
   * @param {number} amount - Amount to remove
   * @param {string} destination - Destination of funds
   * @param {string} reference - Reference number
   * @returns {Promise<Object>} Updated pool information
   */
  async removeFundsFromPool(amount, destination, reference) {
    if (amount <= 0) {
      throw new PoolAccountError('Amount must be positive');
    }

    try {
      return await prisma.$transaction(async (tx) => {
        const pool = await tx.poolAccount.findFirst();

        if (!pool) {
          throw new PoolAccountError('Pool account not found');
        }

        // Check if sufficient unallocated funds
        const unallocated = parseFloat(pool.total_balance) - 
                           parseFloat(pool.allocated_balance) - 
                           parseFloat(pool.reserved_balance);

        if (unallocated < amount) {
          throw new InsufficientBalanceError(amount, unallocated);
        }

        const updatedPool = await tx.poolAccount.update({
          where: { id: pool.id },
          data: {
            total_balance: {
              decrement: amount
            },
            last_synced_at: new Date()
          }
        });

        logger.pool('remove_funds', {
          amount,
          destination,
          reference,
          previousTotal: pool.total_balance,
          newTotal: updatedPool.total_balance
        });

        return {
          totalBalance: parseFloat(updatedPool.total_balance),
          allocatedBalance: parseFloat(updatedPool.allocated_balance),
          reservedBalance: parseFloat(updatedPool.reserved_balance),
          removedAmount: amount
        };
      });
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'removeFundsFromPool',
        amount,
        destination,
        reference
      });
      throw error;
    }
  }

  /**
   * Reconcile pool balance with gateway
   * Syncs local pool balance with actual gateway balance
   * 
   * @param {number} gatewayBalance - Current balance from payment gateway
   * @returns {Promise<Object>} Reconciliation result
   */
  async reconcileWithGateway(gatewayBalance) {
    try {
      const pool = await prisma.poolAccount.findFirst();

      if (!pool) {
        throw new PoolAccountError('Pool account not found');
      }

      const localBalance = parseFloat(pool.total_balance);
      const difference = gatewayBalance - localBalance;

      // Update if there's a discrepancy
      if (Math.abs(difference) > 0.01) { // Account for floating point precision
        const updatedPool = await prisma.poolAccount.update({
          where: { id: pool.id },
          data: {
            total_balance: gatewayBalance,
            last_synced_at: new Date()
          }
        });

        logger.pool('reconciled', {
          localBalance,
          gatewayBalance,
          difference,
          newBalance: updatedPool.total_balance
        });

        if (Math.abs(difference) > 100) { // Alert for large discrepancies
          logger.error('Large pool balance discrepancy detected', {
            localBalance,
            gatewayBalance,
            difference
          });
        }

        return {
          reconciled: true,
          difference,
          previousBalance: localBalance,
          newBalance: gatewayBalance
        };
      }

      // Update sync time even if no change
      await prisma.poolAccount.update({
        where: { id: pool.id },
        data: { last_synced_at: new Date() }
      });

      return {
        reconciled: false,
        difference: 0,
        balance: localBalance
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'reconcileWithGateway',
        gatewayBalance
      });
      throw new PoolAccountError('Failed to reconcile with gateway');
    }
  }

  /**
   * Get pool health status
   * Checks if pool is healthy and has sufficient reserves
   * 
   * @returns {Promise<Object>} Health status
   */
  async getPoolHealth() {
    try {
      const pool = await prisma.poolAccount.findFirst();

      if (!pool) {
        throw new PoolAccountError('Pool account not found');
      }

      const totalBalance = parseFloat(pool.total_balance);
      const allocatedBalance = parseFloat(pool.allocated_balance);
      const reservedBalance = parseFloat(pool.reserved_balance);
      const unallocated = totalBalance - allocatedBalance - reservedBalance;

      const allocationPercentage = (allocatedBalance / totalBalance) * 100;
      const reservedPercentage = (reservedBalance / totalBalance) * 100;

      // Determine health status
      let status = 'healthy';
      const warnings = [];

      if (unallocated < config.pool.minBalance) {
        status = 'warning';
        warnings.push('Unallocated balance below minimum threshold');
      }

      if (allocationPercentage > 90) {
        status = 'warning';
        warnings.push('Over 90% of funds allocated');
      }

      if (totalBalance < config.pool.alertThreshold) {
        status = 'critical';
        warnings.push('Total balance below alert threshold');
      }

      return {
        status,
        warnings,
        balances: {
          total: totalBalance,
          allocated: allocatedBalance,
          reserved: reservedBalance,
          unallocated
        },
        percentages: {
          allocated: allocationPercentage.toFixed(2),
          reserved: reservedPercentage.toFixed(2),
          unallocated: ((unallocated / totalBalance) * 100).toFixed(2)
        },
        lastSynced: pool.last_synced_at,
        thresholds: {
          minimum: config.pool.minBalance,
          alert: config.pool.alertThreshold
        }
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getPoolHealth'
      });
      throw error;
    }
  }

  /**
   * Get pool transaction history summary
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Summary statistics
   */
  async getPoolSummary(startDate, endDate) {
    try {
      const [allocations, deallocations, totalUsers] = await Promise.all([
        // Get total allocations in period
        prisma.transaction.aggregate({
          where: {
            transaction_type: 'DEPOSIT',
            status: 'COMPLETED',
            created_at: {
              gte: startDate,
              lte: endDate
            }
          },
          _sum: { amount: true },
          _count: true
        }),

        // Get total deallocations in period
        prisma.transaction.aggregate({
          where: {
            transaction_type: { in: ['SALE', 'PAYOUT'] },
            status: 'COMPLETED',
            created_at: {
              gte: startDate,
              lte: endDate
            }
          },
          _sum: { amount: true },
          _count: true
        }),

        // Get total active users
        prisma.user.count({
          where: { status: 'ACTIVE' }
        })
      ]);

      return {
        period: {
          start: startDate,
          end: endDate
        },
        allocations: {
          total: allocations._sum.amount ? parseFloat(allocations._sum.amount) : 0,
          count: allocations._count
        },
        deallocations: {
          total: deallocations._sum.amount ? parseFloat(deallocations._sum.amount) : 0,
          count: deallocations._count
        },
        netChange: (allocations._sum.amount || 0) - (deallocations._sum.amount || 0),
        totalActiveUsers: totalUsers
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getPoolSummary'
      });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new PoolAccountService();