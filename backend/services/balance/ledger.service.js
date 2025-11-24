/**
 * Ledger Service
 * 
 * Maintains complete audit trail of all balance changes.
 * Every credit/debit operation is logged here for reconciliation.
 * 
 * Location: src/services/balance/ledgerService.js
 */

const { prisma } = require('../../src/config/database.config');
const logger = require('../../src/shared/utils/logger');
const { DatabaseError } = require('../../src/shared/utils/ApiError');

class LedgerService {
  /**
   * Record a ledger entry
   * @param {Object} entry - Ledger entry data
   * @returns {Promise<Object>} Created ledger entry
   */
  async recordEntry(entry) {
    const {
      user_id,
      transaction_id,
      entry_type,
      amount,
      balance_before,
      balance_after,
      description,
      metadata
    } = entry;

    try {
      // Use transaction table as ledger
      const ledgerEntry = await prisma.transaction.create({
        data: {
          user_id,
          transaction_type: entry_type,
          amount,
          currency: 'USD',
          status: 'COMPLETED',
          description: description || `${entry_type} - Balance ${entry_type === 'DEPOSIT' ? 'credit' : 'debit'}`,
          metadata: {
            ledger: true,
            balance_before,
            balance_after,
            change: balance_after - balance_before,
            ...metadata
          },
          completed_at: new Date()
        }
      });

      logger.info('Ledger entry recorded', {
        entryId: ledgerEntry.id,
        userId: user_id,
        type: entry_type,
        amount,
        balanceBefore: balance_before,
        balanceAfter: balance_after
      });

      return ledgerEntry;

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'recordEntry',
        userId: user_id,
        type: entry_type,
        amount
      });
      throw new DatabaseError('Failed to record ledger entry');
    }
  }

  /**
   * Record a credit entry
   * @param {string} userId - User ID
   * @param {number} amount - Amount credited
   * @param {number} balanceBefore - Balance before credit
   * @param {number} balanceAfter - Balance after credit
   * @param {string} source - Source of credit
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Ledger entry
   */
  async recordCredit(userId, amount, balanceBefore, balanceAfter, source, metadata = {}) {
    return this.recordEntry({
      user_id: userId,
      entry_type: 'DEPOSIT',
      amount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      description: `Credit from ${source}`,
      metadata: {
        source,
        operation: 'credit',
        ...metadata
      }
    });
  }

  /**
   * Record a debit entry
   * @param {string} userId - User ID
   * @param {number} amount - Amount debited
   * @param {number} balanceBefore - Balance before debit
   * @param {number} balanceAfter - Balance after debit
   * @param {string} purpose - Purpose of debit
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Ledger entry
   */
  async recordDebit(userId, amount, balanceBefore, balanceAfter, purpose, metadata = {}) {
    return this.recordEntry({
      user_id: userId,
      entry_type: 'SALE',
      amount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      description: `Debit for ${purpose}`,
      metadata: {
        purpose,
        operation: 'debit',
        ...metadata
      }
    });
  }

  /**
   * Record balance adjustment
   * @param {string} userId - User ID
   * @param {number} amount - Adjustment amount (positive or negative)
   * @param {number} balanceBefore - Balance before adjustment
   * @param {number} balanceAfter - Balance after adjustment
   * @param {string} reason - Reason for adjustment
   * @param {string} adjustedBy - Admin who made adjustment
   * @returns {Promise<Object>} Ledger entry
   */
  async recordAdjustment(userId, amount, balanceBefore, balanceAfter, reason, adjustedBy) {
    return this.recordEntry({
      user_id: userId,
      entry_type: 'ADJUSTMENT',
      amount: Math.abs(amount),
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      description: `Balance adjustment: ${reason}`,
      metadata: {
        adjustment_type: amount > 0 ? 'increase' : 'decrease',
        reason,
        adjusted_by: adjustedBy,
        operation: 'adjustment'
      }
    });
  }

  /**
   * Get ledger entries for user
   * @param {string} userId - User ID
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Paginated ledger entries
   */
  async getUserLedger(userId, filters = {}, pagination = {}) {
    const { startDate, endDate, entry_type } = filters;
    const { page = 1, limit = 50 } = pagination;
    const skip = (page - 1) * limit;

    try {
      const where = {
        user_id: userId,
        'metadata.ledger': true
      };

      if (entry_type) {
        where.transaction_type = entry_type;
      }

      if (startDate || endDate) {
        where.created_at = {};
        if (startDate) where.created_at.gte = new Date(startDate);
        if (endDate) where.created_at.lte = new Date(endDate);
      }

      const [entries, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          skip,
          take: limit,
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            transaction_type: true,
            amount: true,
            description: true,
            metadata: true,
            created_at: true
          }
        }),
        prisma.transaction.count({ where })
      ]);

      return {
        data: entries.map(entry => ({
          id: entry.id,
          type: entry.transaction_type,
          amount: parseFloat(entry.amount),
          description: entry.description,
          balanceBefore: entry.metadata?.balance_before,
          balanceAfter: entry.metadata?.balance_after,
          change: entry.metadata?.change,
          metadata: entry.metadata,
          timestamp: entry.created_at
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getUserLedger',
        userId
      });
      throw new DatabaseError('Failed to get user ledger');
    }
  }

  /**
   * Get ledger summary for user
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Ledger summary
   */
  async getUserLedgerSummary(userId, startDate, endDate) {
    try {
      const where = {
        user_id: userId,
        'metadata.ledger': true,
        created_at: {
          gte: startDate,
          lte: endDate
        }
      };

      const [credits, debits, adjustments] = await Promise.all([
        prisma.transaction.aggregate({
          where: {
            ...where,
            'metadata.operation': 'credit'
          },
          _sum: { amount: true },
          _count: true
        }),
        prisma.transaction.aggregate({
          where: {
            ...where,
            'metadata.operation': 'debit'
          },
          _sum: { amount: true },
          _count: true
        }),
        prisma.transaction.aggregate({
          where: {
            ...where,
            'metadata.operation': 'adjustment'
          },
          _sum: { amount: true },
          _count: true
        })
      ]);

      const totalCredits = parseFloat(credits._sum.amount) || 0;
      const totalDebits = parseFloat(debits._sum.amount) || 0;
      const totalAdjustments = parseFloat(adjustments._sum.amount) || 0;

      return {
        period: {
          start: startDate,
          end: endDate
        },
        credits: {
          total: totalCredits,
          count: credits._count
        },
        debits: {
          total: totalDebits,
          count: debits._count
        },
        adjustments: {
          total: totalAdjustments,
          count: adjustments._count
        },
        netChange: totalCredits - totalDebits
      };

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getUserLedgerSummary',
        userId
      });
      throw new DatabaseError('Failed to get ledger summary');
    }
  }

  /**
   * Reconcile user balance with ledger
   * Verifies balance matches sum of all ledger entries
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Reconciliation result
   */
  async reconcileBalance(userId) {
    try {
      // Get current balance
      const balance = await prisma.accountBalance.findUnique({
        where: { user_id: userId }
      });

      if (!balance) {
        throw new Error('Balance not found');
      }

      // Get all ledger entries
      const entries = await prisma.transaction.findMany({
        where: {
          user_id: userId,
          'metadata.ledger': true
        },
        orderBy: { created_at: 'asc' }
      });

      // Calculate expected balance from ledger
      let calculatedBalance = 0;
      for (const entry of entries) {
        const operation = entry.metadata?.operation;
        const amount = parseFloat(entry.amount);

        if (operation === 'credit') {
          calculatedBalance += amount;
        } else if (operation === 'debit') {
          calculatedBalance -= amount;
        } else if (operation === 'adjustment') {
          const adjustmentType = entry.metadata?.adjustment_type;
          calculatedBalance += adjustmentType === 'increase' ? amount : -amount;
        }
      }

      const actualBalance = parseFloat(balance.available_balance);
      const difference = actualBalance - calculatedBalance;
      const isReconciled = Math.abs(difference) < 0.01; // Allow for rounding

      const result = {
        userId,
        actualBalance,
        calculatedBalance,
        difference,
        isReconciled,
        entryCount: entries.length,
        lastEntry: entries[entries.length - 1]?.created_at
      };

      if (!isReconciled) {
        logger.warn('Balance reconciliation mismatch', result);
      } else {
        logger.info('Balance reconciliation successful', {
          userId,
          balance: actualBalance
        });
      }

      return result;

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'reconcileBalance',
        userId
      });
      throw new DatabaseError('Failed to reconcile balance');
    }
  }

  /**
   * Get all ledger entries (admin)
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Paginated entries
   */
  async getAllLedgerEntries(filters = {}, pagination = {}) {
    const { startDate, endDate, userId, entry_type } = filters;
    const { page = 1, limit = 50 } = pagination;
    const skip = (page - 1) * limit;

    try {
      const where = {
        'metadata.ledger': true
      };

      if (userId) {
        where.user_id = userId;
      }

      if (entry_type) {
        where.transaction_type = entry_type;
      }

      if (startDate || endDate) {
        where.created_at = {};
        if (startDate) where.created_at.gte = new Date(startDate);
        if (endDate) where.created_at.lte = new Date(endDate);
      }

      const [entries, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          skip,
          take: limit,
          orderBy: { created_at: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                business_name: true
              }
            }
          }
        }),
        prisma.transaction.count({ where })
      ]);

      return {
        data: entries.map(entry => ({
          id: entry.id,
          userId: entry.user_id,
          userEmail: entry.user.email,
          businessName: entry.user.business_name,
          type: entry.transaction_type,
          amount: parseFloat(entry.amount),
          description: entry.description,
          balanceBefore: entry.metadata?.balance_before,
          balanceAfter: entry.metadata?.balance_after,
          metadata: entry.metadata,
          timestamp: entry.created_at
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getAllLedgerEntries'
      });
      throw new DatabaseError('Failed to get ledger entries');
    }
  }

  /**
   * Export ledger for accounting
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} Ledger entries in accounting format
   */
  async exportLedger(userId, startDate, endDate) {
    try {
      const entries = await prisma.transaction.findMany({
        where: {
          user_id: userId,
          'metadata.ledger': true,
          created_at: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: { created_at: 'asc' }
      });

      return entries.map((entry, index) => ({
        entryNumber: index + 1,
        date: entry.created_at.toISOString().split('T')[0],
        time: entry.created_at.toISOString().split('T')[1],
        type: entry.transaction_type,
        description: entry.description,
        debit: entry.metadata?.operation === 'debit' ? parseFloat(entry.amount) : 0,
        credit: entry.metadata?.operation === 'credit' ? parseFloat(entry.amount) : 0,
        balance: entry.metadata?.balance_after || 0,
        reference: entry.id
      }));

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'exportLedger',
        userId
      });
      throw new DatabaseError('Failed to export ledger');
    }
  }
}

// Export singleton instance
module.exports = new LedgerService();