/**
 * Deposit Controller
 * 
 * Handles HTTP requests for deposit-related endpoints.
 * 
 * Location: backend/api/v1/controllers/deposit.controller.js
 */

const depositService = require('../../../services/deposit/deposit.service');
const { successResponse, createdResponse } = require('../../../src/shared/utils/response');

class DepositController {
  /**
   * @desc    Create a deposit request
   * @route   POST /api/v1/deposits
   * @access  Private
   */
  async createDeposit(req, res, next) {
    try {
      const userId = req.userId;
      const { amount, payment_method, gateway_reference } = req.body;

      const deposit = await depositService.createDepositRequest(userId, {
        amount,
        payment_method,
        gateway_reference
      });

      return createdResponse(
        res,
        deposit,
        'Deposit request created successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get user's deposit history
   * @route   GET /api/v1/deposits
   * @access  Private
   */
  async getDepositHistory(req, res, next) {
    try {
      const userId = req.userId;
      const { status, page, limit } = req.query;

      const deposits = await depositService.getDepositHistory(
        userId,
        { status },
        { page: parseInt(page) || 1, limit: parseInt(limit) || 20 }
      );

      return successResponse(
        res,
        deposits,
        'Deposit history retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get single deposit by ID
   * @route   GET /api/v1/deposits/:depositId
   * @access  Private
   */
  async getDeposit(req, res, next) {
    try {
      const userId = req.userId;
      const { depositId } = req.params;

      const deposit = await depositService.getDeposit(depositId, userId);

      return successResponse(
        res,
        deposit,
        'Deposit retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Cancel deposit request
   * @route   DELETE /api/v1/deposits/:depositId
   * @access  Private
   */
  async cancelDeposit(req, res, next) {
    try {
      const userId = req.userId;
      const { depositId } = req.params;

      const deposit = await depositService.cancelDeposit(depositId, userId);

      return successResponse(
        res,
        deposit,
        'Deposit cancelled successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get deposit statistics
   * @route   GET /api/v1/deposits/stats
   * @access  Private
   */
  async getDepositStats(req, res, next) {
    try {
      const userId = req.userId;

      const stats = await depositService.getUserDepositStats(userId);

      return successResponse(
        res,
        stats,
        'Deposit statistics retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get all pending deposits (Admin)
   * @route   GET /api/v1/deposits/admin/pending
   * @access  Private (Admin)
   */
  async getPendingDeposits(req, res, next) {
    try {
      const { page, limit } = req.query;

      const deposits = await depositService.getPendingDeposits({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20
      });

      return successResponse(
        res,
        deposits,
        'Pending deposits retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Approve deposit request (Admin)
   * @route   POST /api/v1/deposits/:depositId/approve
   * @access  Private (Admin)
   */
  async approveDeposit(req, res, next) {
    try {
      const { depositId } = req.params;
      const approvedBy = req.userId;

      const deposit = await depositService.approveDeposit(depositId, approvedBy);

      return successResponse(
        res,
        deposit,
        'Deposit approved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Reject deposit request (Admin)
   * @route   POST /api/v1/deposits/:depositId/reject
   * @access  Private (Admin)
   */
  async rejectDeposit(req, res, next) {
    try {
      const { depositId } = req.params;
      const { reason } = req.body;

      const deposit = await depositService.rejectDeposit(depositId, reason);

      return successResponse(
        res,
        deposit,
        'Deposit rejected successfully'
      );
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
module.exports = new DepositController();