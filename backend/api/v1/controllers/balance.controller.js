/**
 * Balance Controller
 * 
 * Handles HTTP requests for balance-related endpoints.
 * 
 * Location: backend/api/v1/controllers/balance.controller.js
 */

const balanceService = require('../../../services/balance/balance.service');
const { successResponse } = require('../../../src/shared/utils/response');
const logger = require('../../../src/shared/utils/logger');

class BalanceController {
  /**
   * @desc    Get user's balance
   * @route   GET /api/v1/balance
   * @access  Private
   */
  async getBalance(req, res, next) {
    try {
      const userId = req.userId;

      const balance = await balanceService.getBalance(userId);

      logger.info('Balance retrieved', {
        userId,
        balance: balance.available
      });

      return successResponse(
        res,
        balance,
        'Balance retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get detailed balance summary
   * @route   GET /api/v1/balance/summary
   * @access  Private
   */
  async getBalanceSummary(req, res, next) {
    try {
      const userId = req.userId;

      const summary = await balanceService.getBalanceSummary(userId);

      return successResponse(
        res,
        summary,
        'Balance summary retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Check if user has sufficient balance
   * @route   POST /api/v1/balance/check
   * @access  Private
   */
  async checkSufficientBalance(req, res, next) {
    try {
      const userId = req.userId;
      const { amount } = req.body;

      const hasSufficientBalance = await balanceService.checkSufficientBalance(
        userId,
        amount
      );

      return successResponse(
        res,
        {
          amount,
          hasSufficientBalance
        },
        hasSufficientBalance 
          ? 'Sufficient balance available' 
          : 'Insufficient balance'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get balance history/ledger
   * @route   GET /api/v1/balance/history
   * @access  Private
   */
  async getBalanceHistory(req, res, next) {
    try {
      const userId = req.userId;
      const { page, limit, startDate, endDate, entry_type } = req.query;

      const ledgerService = require('../../../services/balance/ledger.service');

      const history = await ledgerService.getUserLedger(
        userId,
        { startDate, endDate, entry_type },
        { page: parseInt(page) || 1, limit: parseInt(limit) || 20 }
      );

      return successResponse(
        res,
        history,
        'Balance history retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get balance statistics
   * @route   GET /api/v1/balance/stats
   * @access  Private
   */
  async getBalanceStats(req, res, next) {
    try {
      const userId = req.userId;
      const { startDate, endDate } = req.query;

      const ledgerService = require('../../../services/balance/ledger.service');

      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const stats = await ledgerService.getUserLedgerSummary(userId, start, end);

      return successResponse(
        res,
        stats,
        'Balance statistics retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Reconcile user balance (check for discrepancies)
   * @route   POST /api/v1/balance/reconcile
   * @access  Private
   */
  async reconcileBalance(req, res, next) {
    try {
      const userId = req.userId;

      const ledgerService = require('../../../services/balance/ledger.service');
      const reconciliation = await ledgerService.reconcileBalance(userId);

      return successResponse(
        res,
        reconciliation,
        reconciliation.isReconciled 
          ? 'Balance is reconciled' 
          : 'Balance discrepancy detected'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get all user balances (Admin only)
   * @route   GET /api/v1/balance/all
   * @access  Private (Admin)
   */
  async getAllBalances(req, res, next) {
    try {
      const { page, limit, minBalance, maxBalance } = req.query;

      const balanceRepository = require('../../../database/repositories/balance.repository');

      const balances = await balanceRepository.getAllBalances(
        { minBalance, maxBalance },
        { page: parseInt(page) || 1, limit: parseInt(limit) || 20 }
      );

      return successResponse(
        res,
        balances,
        'All balances retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get total allocated balance across all users (Admin only)
   * @route   GET /api/v1/balance/total-allocated
   * @access  Private (Admin)
   */
  async getTotalAllocated(req, res, next) {
    try {
      const balanceRepository = require('../../../database/repositories/balance.repository');

      const totalAllocated = await balanceRepository.getTotalAllocated();

      return successResponse(
        res,
        totalAllocated,
        'Total allocated balance retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get users with low balance (Admin only)
   * @route   GET /api/v1/balance/low-balance
   * @access  Private (Admin)
   */
  async getLowBalanceUsers(req, res, next) {
    try {
      const { threshold } = req.query;

      const balanceRepository = require('../../../database/repositories/balance.repository');

      const users = await balanceRepository.getLowBalanceUsers(
        threshold ? parseFloat(threshold) : 100
      );

      return successResponse(
        res,
        users,
        'Low balance users retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get balance statistics for all users (Admin only)
   * @route   GET /api/v1/balance/stats/all
   * @access  Private (Admin)
   */
  async getAllBalanceStats(req, res, next) {
    try {
      const balanceRepository = require('../../../database/repositories/balance.repository');

      const stats = await balanceRepository.getStats();

      return successResponse(
        res,
        stats,
        'Balance statistics retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Adjust user balance (Admin only)
   * @route   POST /api/v1/balance/adjust/:userId
   * @access  Private (Admin)
   */
  async adjustBalance(req, res, next) {
    try {
      const { userId } = req.params;
      const { amount, reason } = req.body;
      const adminId = req.userId;

      const balanceRepository = require('../../../database/repositories/balance.repository');
      const ledgerService = require('../../../services/balance/ledger.service');

      // Get current balance
      const currentBalance = await balanceRepository.getByUserId(userId);
      const balanceBefore = parseFloat(currentBalance.available_balance);

      // Adjust balance
      const adjustmentAmount = parseFloat(amount);
      let updatedBalance;

      if (adjustmentAmount > 0) {
        // Increase balance
        updatedBalance = await balanceRepository.creditAvailable(userId, adjustmentAmount);
      } else {
        // Decrease balance
        updatedBalance = await balanceRepository.debitAvailable(userId, Math.abs(adjustmentAmount));
      }

      const balanceAfter = parseFloat(updatedBalance.available_balance);

      // Record in ledger
      await ledgerService.recordAdjustment(
        userId,
        adjustmentAmount,
        balanceBefore,
        balanceAfter,
        reason,
        adminId
      );

      logger.security('Balance adjusted by admin', {
        userId,
        adminId,
        amount: adjustmentAmount,
        reason,
        balanceBefore,
        balanceAfter
      });

      return successResponse(
        res,
        {
          balanceBefore,
          balanceAfter,
          adjustment: adjustmentAmount,
          reason
        },
        'Balance adjusted successfully'
      );
    } catch (error) {
      next(error);
    }
  }


    /**
   * @desc    Export ledger
   * @route   GET /api/v1/balance/ledger/export
   * @access  Private
   */
  async exportLedger(req, res, next) {
    try {
      const userId = req.userId;
      const { startDate, endDate } = req.query;

      // Default to last 30 days
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const ledgerData = await ledgerService.exportLedger(userId, start, end);

      return successResponse(
        res,
        {
          entries: ledgerData,
          period: {
            start: start.toISOString(),
            end: end.toISOString()
          }
        },
        'Ledger exported successfully'
      );
    } catch (error) {
      next(error);
    }
  }

   /**
   * @desc    Get ledger summary
   * @route   GET /api/v1/balance/ledger/summary
   * @access  Private
   */
  async getLedgerSummary(req, res, next) {
    try {
      const userId = req.userId;
      const { startDate, endDate } = req.query;

      // Default to last 30 days if not provided
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const summary = await ledgerService.getUserLedgerSummary(userId, start, end);

      return successResponse(
        res,
        summary,
        'Ledger summary retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

    /**
   * @desc    Get ledger entries
   * @route   GET /api/v1/balance/ledger
   * @access  Private
   */
  async getLedgerEntries(req, res, next) {
    try {
      const userId = req.userId;
      const { entry_type, startDate, endDate, page = 1, limit = 50 } = req.query;

      const filters = {};
      if (entry_type) filters.entry_type = entry_type;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const ledger = await ledgerService.getUserLedger(userId, filters, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      return successResponse(
        res,
        ledger,
        'Ledger entries retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Reconcile balance
   * @route   POST /api/v1/balance/reconcile
   * @access  Private
   */
  async reconcileBalance(req, res, next) {
    try {
      const userId = req.userId;

      const result = await ledgerService.reconcileBalance(userId);

      return successResponse(
        res,
        result,
        result.isReconciled 
          ? 'Balance reconciled successfully' 
          : 'Balance reconciliation mismatch detected'
      );
    } catch (error) {
      next(error);
    }
  }


  
}

// Export singleton instance
module.exports = new BalanceController();