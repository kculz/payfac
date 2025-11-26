/**
 * User Controller
 * 
 * Handles HTTP requests for user management.
 * 
 * Location: backend/api/v1/controllers/user.controller.js
 */

const userRepository = require('../../../database/repositories/user.repository');
const balanceService = require('../../../services/balance/balance.service');
const { successResponse } = require('../../../src/shared/utils/response');

class UserController {
  /**
   * @desc    Get user profile
   * @route   GET /api/v1/users/profile
   * @access  Private
   */
  async getProfile(req, res, next) {
    try {
      const userId = req.userId;

      const user = await userRepository.getUserWithBalance(userId);
      const balanceSummary = await balanceService.getBalanceSummary(userId);

      return successResponse(
        res,
        {
          user: userRepository.sanitizeUser(user),
          balance: balanceSummary
        },
        'Profile retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Update user profile
   * @route   PUT /api/v1/users/profile
   * @access  Private
   */
  async updateProfile(req, res, next) {
    try {
      const userId = req.userId;
      const { business_name, phone } = req.body;

      const updatedUser = await userRepository.updateProfile(userId, {
        business_name,
        phone
      });

      return successResponse(
        res,
        updatedUser,
        'Profile updated successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get user statistics
   * @route   GET /api/v1/users/stats
   * @access  Private
   */
  async getStats(req, res, next) {
    try {
      const userId = req.userId;

      const stats = await userRepository.getUserStats(userId);

      return successResponse(
        res,
        stats,
        'Statistics retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get all users (Admin only)
   * @route   GET /api/v1/users
   * @access  Private (Admin)
   */
  async getAllUsers(req, res, next) {
    try {
      const { status, role, search, page = 1, limit = 20 } = req.query;

      const filters = {};
      if (status) filters.status = status;
      if (role) filters.role = role;
      if (search) filters.search = search;

      const users = await userRepository.getUsers(filters, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

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
   * @desc    Get user by ID (Admin only)
   * @route   GET /api/v1/users/:userId
   * @access  Private (Admin)
   */
  async getUserById(req, res, next) {
    try {
      const { userId } = req.params;

      const user = await userRepository.getUserWithBalance(userId);
      const balanceSummary = await balanceService.getBalanceSummary(userId);
      const stats = await userRepository.getUserStats(userId);

      return successResponse(
        res,
        {
          user: userRepository.sanitizeUser(user),
          balance: balanceSummary,
          stats: stats.stats
        },
        'User retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Suspend user (Admin only)
   * @route   POST /api/v1/users/:userId/suspend
   * @access  Private (Admin)
   */
  async suspendUser(req, res, next) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;

      const user = await userRepository.suspendUser(userId, reason);

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
   * @desc    Activate user (Admin only)
   * @route   POST /api/v1/users/:userId/activate
   * @access  Private (Admin)
   */
  async activateUser(req, res, next) {
    try {
      const { userId } = req.params;

      const user = await userRepository.activateUser(userId);

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
   * @desc    Search users (Admin only)
   * @route   GET /api/v1/users/search
   * @access  Private (Admin)
   */
  async searchUsers(req, res, next) {
    try {
      const { query, limit = 10 } = req.query;

      const users = await userRepository.searchUsers(query, parseInt(limit));

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
   * @desc    Get user by status (Admin only)
   * @route   GET /api/v1/users/by-status/:status
   * @access  Private (Admin)
   */
  async getUsersByStatus(req, res, next) {
    try {
      const { status } = req.params;

      const users = await userRepository.getUsersByStatus(status);

      return successResponse(
        res,
        users,
        `${status} users retrieved successfully`
      );
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
module.exports = new UserController();