/**
 * Transaction Controller
 * 
 * Handles HTTP requests for transaction operations.
 * 
 * Location: backend/api/v1/controllers/transaction.controller.js
 */

const transactionService = require('../../../services/transaction/transaction.service');
const transactionRepository = require('../../../database/repositories/transaction.repository');
const { successResponse, createdResponse } = require('../../../src/shared/utils/response');
const { BadRequestError, NotFoundError } = require('../../../src/shared/utils/ApiError');

class TransactionController {
  /**
   * @desc    Process a sale transaction
   * @route   POST /api/v1/transactions/sale
   * @access  Private
   */
  async processSale(req, res, next) {
    try {
      const userId = req.userId;
      const { amount, customer_name, customer_email, description, items, metadata } = req.body;

      const transaction = await transactionService.processSale(userId, {
        amount,
        customer_name,
        customer_email,
        description,
        items,
        metadata
      });

      return createdResponse(
        res,
        {
          id: transaction.id,
          type: transaction.transaction_type,
          amount: parseFloat(transaction.amount),
          currency: transaction.currency,
          status: transaction.status,
          description: transaction.description,
          customer_name: transaction.customer_name,
          customer_email: transaction.customer_email,
          createdAt: transaction.created_at,
          completedAt: transaction.completed_at
        },
        'Sale processed successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Process a refund
   * @route   POST /api/v1/transactions/:transactionId/refund
   * @access  Private
   */
  async processRefund(req, res, next) {
    try {
      const userId = req.userId;
      const { transactionId } = req.params;
      const { amount, reason } = req.body;

      const refund = await transactionService.processRefund(userId, transactionId, {
        amount,
        reason
      });

      return createdResponse(
        res,
        {
          id: refund.id,
          type: refund.transaction_type,
          amount: parseFloat(refund.amount),
          currency: refund.currency,
          status: refund.status,
          description: refund.description,
          originalTransactionId: transactionId,
          createdAt: refund.created_at
        },
        'Refund processed successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get transaction by ID
   * @route   GET /api/v1/transactions/:transactionId
   * @access  Private
   */
  async getTransaction(req, res, next) {
    try {
      const userId = req.userId;
      const { transactionId } = req.params;

      const transaction = await transactionService.getTransaction(transactionId, userId);

      return successResponse(
        res,
        {
          id: transaction.id,
          type: transaction.transaction_type,
          amount: parseFloat(transaction.amount),
          currency: transaction.currency,
          status: transaction.status,
          description: transaction.description,
          customer_name: transaction.customer_name,
          customer_email: transaction.customer_email,
          metadata: transaction.metadata,
          createdAt: transaction.created_at,
          completedAt: transaction.completed_at,
          failedAt: transaction.failed_at
        },
        'Transaction retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get transaction history
   * @route   GET /api/v1/transactions
   * @access  Private
   */
  async getTransactionHistory(req, res, next) {
    try {
      const userId = req.userId;
      const { status, type, startDate, endDate, page, limit } = req.query;

      const history = await transactionService.getTransactionHistory(
        userId,
        { status, type, startDate, endDate },
        { page: parseInt(page) || 1, limit: parseInt(limit) || 20 }
      );

      return successResponse(
        res,
        history,
        'Transaction history retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get recent transactions
   * @route   GET /api/v1/transactions/recent
   * @access  Private
   */
  async getRecentTransactions(req, res, next) {
    try {
      const userId = req.userId;
      const { limit = 10 } = req.query;

      const transactions = await transactionService.getRecentTransactions(
        userId,
        parseInt(limit)
      );

      return successResponse(
        res,
        transactions,
        'Recent transactions retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get transaction statistics
   * @route   GET /api/v1/transactions/stats
   * @access  Private
   */
  async getTransactionStats(req, res, next) {
    try {
      const userId = req.userId;
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      const stats = await transactionService.getTransactionStats(userId, start, end);

      return successResponse(
        res,
        stats,
        'Transaction statistics retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get daily transaction summary
   * @route   GET /api/v1/transactions/summary/daily
   * @access  Private
   */
  async getDailySummary(req, res, next) {
    try {
      const userId = req.userId;
      const { date } = req.query;

      const summaryDate = date ? new Date(date) : new Date();
      const summary = await transactionService.getDailySummary(userId, summaryDate);

      return successResponse(
        res,
        summary,
        'Daily summary retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get monthly transaction summary
   * @route   GET /api/v1/transactions/summary/monthly
   * @access  Private
   */
  async getMonthlySummary(req, res, next) {
    try {
      const userId = req.userId;
      const { year, month } = req.query;

      const currentDate = new Date();
      const summaryYear = year ? parseInt(year) : currentDate.getFullYear();
      const summaryMonth = month ? parseInt(month) : currentDate.getMonth() + 1;

      const summary = await transactionService.getMonthlySummary(
        userId,
        summaryYear,
        summaryMonth
      );

      return successResponse(
        res,
        summary,
        'Monthly summary retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Search transactions
   * @route   GET /api/v1/transactions/search
   * @access  Private
   */
  async searchTransactions(req, res, next) {
    try {
      const userId = req.userId;
      const { query, limit } = req.query;

      const results = await transactionService.searchTransactions(
        userId,
        query,
        { limit: parseInt(limit) || 20 }
      );

      return successResponse(
        res,
        results,
        'Search results retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Cancel a pending transaction
   * @route   POST /api/v1/transactions/:transactionId/cancel
   * @access  Private
   */
  async cancelTransaction(req, res, next) {
    try {
      const userId = req.userId;
      const { transactionId } = req.params;

      const transaction = await transactionService.cancelTransaction(transactionId, userId);

      return successResponse(
        res,
        {
          id: transaction.id,
          status: transaction.status
        },
        'Transaction cancelled successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  // ============================================================================
  // ADMIN METHODS
  // ============================================================================

  /**
   * @desc    Get all transactions across all users (Admin)
   * @route   GET /api/v1/transactions/admin/all
   * @access  Private (Admin)
   */
  async getAllTransactions(req, res, next) {
    try {
      const { status, type, startDate, endDate, userId, page, limit } = req.query;

      const filters = {
        status,
        type,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        userId
      };

      const pagination = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20
      };

      const transactions = await transactionRepository.findAll(filters, pagination);

      return successResponse(
        res,
        transactions,
        'All transactions retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get transaction statistics for all users (Admin)
   * @route   GET /api/v1/transactions/admin/stats
   * @access  Private (Admin)
   */
  async getAllTransactionStats(req, res, next) {
    try {
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      const stats = await transactionRepository.getAdminStats(start, end);

      return successResponse(
        res,
        stats,
        'Admin transaction statistics retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get transactions for a specific user (Admin)
   * @route   GET /api/v1/transactions/admin/user/:userId
   * @access  Private (Admin)
   */
  async getUserTransactions(req, res, next) {
    try {
      const { userId } = req.params;
      const { status, type, startDate, endDate, page, limit } = req.query;

      const history = await transactionService.getTransactionHistory(
        userId,
        { status, type, startDate, endDate },
        { page: parseInt(page) || 1, limit: parseInt(limit) || 20 }
      );

      return successResponse(
        res,
        history,
        'User transactions retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Force refund a transaction (Admin override)
   * @route   POST /api/v1/transactions/admin/:transactionId/refund
   * @access  Private (Admin)
   */
  async adminForceRefund(req, res, next) {
    try {
      const adminId = req.userId;
      const { transactionId } = req.params;
      const { amount, reason } = req.body;

      // Get original transaction
      const originalTransaction = await transactionRepository.findById(transactionId);

      if (!originalTransaction) {
        throw new NotFoundError('Transaction');
      }

      // Verify transaction is refundable
      if (originalTransaction.status !== 'COMPLETED') {
        throw new BadRequestError('Only completed transactions can be refunded');
      }

      if (originalTransaction.transaction_type !== 'SALE') {
        throw new BadRequestError('Only sale transactions can be refunded');
      }

      // Determine refund amount
      const refundAmount = amount || parseFloat(originalTransaction.amount);

      // Validate refund amount
      if (refundAmount > parseFloat(originalTransaction.amount)) {
        throw new BadRequestError('Refund amount cannot exceed original transaction amount');
      }

      // Create refund transaction
      const refundTransaction = await transactionRepository.createRefund(
        {
          user_id: originalTransaction.user_id,
          transaction_type: 'REFUND',
          amount: refundAmount,
          currency: originalTransaction.currency,
          status: 'COMPLETED',
          description: `Admin refund for transaction ${transactionId}: ${reason}`,
          metadata: {
            original_transaction_id: transactionId,
            reason,
            admin_id: adminId,
            forced_refund: true
          },
          completed_at: new Date()
        },
        transactionId
      );

      // Allocate funds back to user
      const poolAccountService = require('../../../services/poolAccount/poolAccount.service');
      await poolAccountService.allocateToUser(originalTransaction.user_id, refundAmount);

      return createdResponse(
        res,
        {
          id: refundTransaction.id,
          type: refundTransaction.transaction_type,
          amount: parseFloat(refundTransaction.amount),
          currency: refundTransaction.currency,
          status: refundTransaction.status,
          description: refundTransaction.description,
          originalTransactionId: transactionId,
          userId: originalTransaction.user_id,
          createdAt: refundTransaction.created_at
        },
        'Admin refund processed successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Update transaction status (Admin)
   * @route   PATCH /api/v1/transactions/admin/:transactionId/status
   * @access  Private (Admin)
   */
  async updateTransactionStatus(req, res, next) {
    try {
      const adminId = req.userId;
      const { transactionId } = req.params;
      const { status, reason } = req.body;

      // Get transaction
      const transaction = await transactionRepository.findById(transactionId);

      if (!transaction) {
        throw new NotFoundError('Transaction');
      }

      // Validate status transition
      const validTransitions = {
        'PENDING': ['PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
        'PROCESSING': ['COMPLETED', 'FAILED', 'CANCELLED'],
        'COMPLETED': ['REFUNDED'],
        'FAILED': ['PENDING', 'PROCESSING'],
        'REFUNDED': [],
        'CANCELLED': []
      };

      const allowedTransitions = validTransitions[transaction.status] || [];
      if (!allowedTransitions.includes(status)) {
        throw new BadRequestError(
          `Cannot transition from ${transaction.status} to ${status}. ` +
          `Allowed transitions: ${allowedTransitions.join(', ')}`
        );
      }

      // Update transaction status
      const updatedTransaction = await transactionRepository.updateStatus(
        transactionId,
        status,
        reason,
        adminId
      );

      return successResponse(
        res,
        {
          id: updatedTransaction.id,
          status: updatedTransaction.status,
          previousStatus: transaction.status,
          updatedAt: updatedTransaction.updated_at
        },
        'Transaction status updated successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get failed transactions (Admin)
   * @route   GET /api/v1/transactions/admin/failed
   * @access  Private (Admin)
   */
  async getFailedTransactions(req, res, next) {
    try {
      const { startDate, endDate, page, limit } = req.query;

      const filters = {
        status: 'FAILED',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null
      };

      const pagination = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20
      };

      const transactions = await transactionRepository.findAll(filters, pagination);

      return successResponse(
        res,
        transactions,
        'Failed transactions retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
module.exports = new TransactionController();