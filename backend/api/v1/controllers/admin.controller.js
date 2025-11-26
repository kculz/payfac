/**
 * Admin Controller
 * 
 * Handles HTTP requests for admin-related endpoints.
 * 
 * Location: backend/api/v1/controllers/admin.controller.js
 */

const userRepository = require('../../../database/repositories/user.repository');
const balanceRepository = require('../../../database/repositories/balance.repository');
const poolAccountService = require('../../../services/poolAccount/poolAccount.service');
const { successResponse } = require('../../../src/shared/utils/response');
const logger = require('../../../src/shared/utils/logger');

class AdminController {
  /**
   * @desc    Get all users
   * @route   GET /api/v1/admin/users
   * @access  Private (Admin)
   */
  async getAllUsers(req, res, next) {
    try {
      const { status, role, search, page, limit } = req.query;

      const users = await userRepository.getUsers(
        { status, role, search },
        { page: parseInt(page) || 1, limit: parseInt(limit) || 20 }
      );

      return successResponse(
        res,
        users,
        'Users retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get user by ID
   * @route   GET /api/v1/admin/users/:userId
   * @access  Private (Admin)
   */
  async getUserById(req, res, next) {
    try {
      const { userId } = req.params;

      const user = await userRepository.getUserWithBalance(userId);

      return successResponse(
        res,
        user,
        'User retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get user statistics
   * @route   GET /api/v1/admin/users/:userId/stats
   * @access  Private (Admin)
   */
  async getUserStats(req, res, next) {
    try {
      const { userId } = req.params;

      const stats = await userRepository.getUserStats(userId);

      return successResponse(
        res,
        stats,
        'User statistics retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Update user status
   * @route   PATCH /api/v1/admin/users/:userId/status
   * @access  Private (Admin)
   */
  async updateUserStatus(req, res, next) {
    try {
      const { userId } = req.params;
      const { status } = req.body;
      const adminId = req.userId;

      const user = await userRepository.updateStatus(userId, status);

      logger.security('User status updated by admin', {
        userId,
        adminId,
        newStatus: status
      });

      return successResponse(
        res,
        user,
        'User status updated successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Suspend user account
   * @route   POST /api/v1/admin/users/:userId/suspend
   * @access  Private (Admin)
   */
  async suspendUser(req, res, next) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const adminId = req.userId;

      const user = await userRepository.suspendUser(userId, reason);

      logger.security('User suspended by admin', {
        userId,
        adminId,
        reason
      });

      return successResponse(
        res,
        user,
        'User suspended successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Activate user account
   * @route   POST /api/v1/admin/users/:userId/activate
   * @access  Private (Admin)
   */
  async activateUser(req, res, next) {
    try {
      const { userId } = req.params;
      const adminId = req.userId;

      const user = await userRepository.activateUser(userId);

      logger.security('User activated by admin', {
        userId,
        adminId
      });

      return successResponse(
        res,
        user,
        'User activated successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get pool account status
   * @route   GET /api/v1/admin/pool
   * @access  Private (Admin)
   */
  async getPoolStatus(req, res, next) {
    try {
      const poolStatus = await poolAccountService.getPoolStatus();

      return successResponse(
        res,
        poolStatus,
        'Pool account status retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get pool health
   * @route   GET /api/v1/admin/pool/health
   * @access  Private (Admin)
   */
  async getPoolHealth(req, res, next) {
    try {
      const health = await poolAccountService.getPoolHealth();

      return successResponse(
        res,
        health,
        'Pool health retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get pool summary
   * @route   GET /api/v1/admin/pool/summary
   * @access  Private (Admin)
   */
  async getPoolSummary(req, res, next) {
    try {
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const summary = await poolAccountService.getPoolSummary(start, end);

      return successResponse(
        res,
        summary,
        'Pool summary retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Add funds to pool
   * @route   POST /api/v1/admin/pool/add-funds
   * @access  Private (Admin)
   */
  async addFundsToPool(req, res, next) {
    try {
      const { amount, source, reference } = req.body;
      const adminId = req.userId;

      const result = await poolAccountService.addFundsToPool(amount, source, reference);

      logger.security('Funds added to pool by admin', {
        adminId,
        amount,
        source,
        reference
      });

      return successResponse(
        res,
        result,
        'Funds added to pool successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Remove funds from pool
   * @route   POST /api/v1/admin/pool/remove-funds
   * @access  Private (Admin)
   */
  async removeFundsFromPool(req, res, next) {
    try {
      const { amount, destination, reference } = req.body;
      const adminId = req.userId;

      const result = await poolAccountService.removeFundsFromPool(
        amount,
        destination,
        reference
      );

      logger.security('Funds removed from pool by admin', {
        adminId,
        amount,
        destination,
        reference
      });

      return successResponse(
        res,
        result,
        'Funds removed from pool successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Reconcile pool with gateway
   * @route   POST /api/v1/admin/pool/reconcile
   * @access  Private (Admin)
   */
  async reconcilePool(req, res, next) {
    try {
      const { gateway_balance } = req.body;

      const result = await poolAccountService.reconcileWithGateway(gateway_balance);

      logger.info('Pool reconciled with gateway', {
        adminId: req.userId,
        result
      });

      return successResponse(
        res,
        result,
        'Pool reconciled successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get dashboard statistics
   * @route   GET /api/v1/admin/dashboard
   * @access  Private (Admin)
   */
  async getDashboardStats(req, res, next) {
    try {
      const [
        activeUsers,
        poolStatus,
        balanceStats,
        todayTransactions
      ] = await Promise.all([
        userRepository.count({ status: 'ACTIVE' }),
        poolAccountService.getPoolStatus(),
        balanceRepository.getStats(),
        // You can add transaction count here when implemented
        Promise.resolve(0)
      ]);

      const stats = {
        users: {
          active: activeUsers,
          total: balanceStats.totalUsers
        },
        pool: poolStatus,
        balances: balanceStats,
        transactions: {
          today: todayTransactions
        }
      };

      return successResponse(
        res,
        stats,
        'Dashboard statistics retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Search users
   * @route   GET /api/v1/admin/users/search
   * @access  Private (Admin)
   */
  async searchUsers(req, res, next) {
    try {
      const { query, limit } = req.query;

      const users = await userRepository.searchUsers(
        query,
        parseInt(limit) || 10
      );

      return successResponse(
        res,
        users,
        'Search results retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get active seller count
   * @route   GET /api/v1/admin/stats/active-sellers
   * @access  Private (Admin)
   */
  async getActiveSellerCount(req, res, next) {
    try {
      const count = await userRepository.getActiveSellerCount();

      return successResponse(
        res,
        { count },
        'Active seller count retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
module.exports = new AdminController();