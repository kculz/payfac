/**
 * Payout Controller
 * 
 * Handles HTTP requests for payout operations.
 * 
 * Location: backend/api/v1/controllers/payout.controller.js
 */

const payoutService = require('../../../services/payout/payout.service');
const { successResponse, createdResponse } = require('../../../src/shared/utils/response');

class PayoutController {
  /**
   * @desc    Create payout request
   * @route   POST /api/v1/payouts
   * @access  Private
   */
  async createPayoutRequest(req, res, next) {
    try {
      const userId = req.userId;
      const { amount, bank_account_id } = req.body;

      const payout = await payoutService.createPayoutRequest(userId, {
        amount,
        bank_account_id
      });

      return createdResponse(
        res,
        {
          id: payout.id,
          amount: parseFloat(payout.amount),
          currency: payout.currency,
          status: payout.status,
          bank_account_id: payout.bank_account_id,
          createdAt: payout.created_at
        },
        'Payout request created successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get payout history
   * @route   GET /api/v1/payouts
   * @access  Private
   */
  async getPayoutHistory(req, res, next) {
    try {
      const userId = req.userId;
      const { status, page = 1, limit = 20 } = req.query;

      const filters = {};
      if (status) filters.status = status;

      const history = await payoutService.getPayoutHistory(userId, filters, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      return successResponse(
        res,
        history,
        'Payout history retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get payout by ID
   * @route   GET /api/v1/payouts/:payoutId
   * @access  Private
   */
  async getPayout(req, res, next) {
    try {
      const userId = req.userId;
      const { payoutId } = req.params;

      const payout = await payoutService.getPayout(payoutId, userId);

      return successResponse(
        res,
        {
          id: payout.id,
          amount: parseFloat(payout.amount),
          currency: payout.currency,
          status: payout.status,
          bank_account_id: payout.bank_account_id,
          processed_by: payout.processed_by,
          gateway_reference: payout.gateway_reference,
          rejection_reason: payout.rejection_reason,
          expected_arrival_date: payout.expected_arrival_date,
          createdAt: payout.created_at,
          processedAt: payout.processed_at,
          completedAt: payout.completed_at,
          failedAt: payout.failed_at
        },
        'Payout retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get payout statistics
   * @route   GET /api/v1/payouts/stats
   * @access  Private
   */
  async getPayoutStats(req, res, next) {
    try {
      const userId = req.userId;

      const stats = await payoutService.getUserPayoutStats(userId);

      return successResponse(
        res,
        stats,
        'Payout statistics retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Cancel payout request
   * @route   POST /api/v1/payouts/:payoutId/cancel
   * @access  Private
   */
  async cancelPayout(req, res, next) {
    try {
      const userId = req.userId;
      const { payoutId } = req.params;

      const payout = await payoutService.cancelPayout(payoutId, userId);

      return successResponse(
        res,
        {
          id: payout.id,
          status: payout.status
        },
        'Payout cancelled successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get pending payouts (Admin only)
   * @route   GET /api/v1/payouts/pending
   * @access  Private (Admin)
   */
  async getPendingPayouts(req, res, next) {
    try {
      const { page = 1, limit = 20 } = req.query;

      const payouts = await payoutService.getPendingPayouts({
        page: parseInt(page),
        limit: parseInt(limit)
      });

      return successResponse(
        res,
        payouts,
        'Pending payouts retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Process payout (Admin only)
   * @route   POST /api/v1/payouts/:payoutId/process
   * @access  Private (Admin)
   */
  async processPayout(req, res, next) {
    try {
      const adminId = req.userId;
      const { payoutId } = req.params;

      const payout = await payoutService.processPayout(payoutId, adminId);

      return successResponse(
        res,
        {
          id: payout.id,
          amount: parseFloat(payout.amount),
          status: payout.status,
          processed_by: payout.processed_by,
          gateway_reference: payout.gateway_reference,
          processed_at: payout.processed_at,
          completed_at: payout.completed_at
        },
        'Payout processed successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Reject payout (Admin only)
   * @route   POST /api/v1/payouts/:payoutId/reject
   * @access  Private (Admin)
   */
  async rejectPayout(req, res, next) {
    try {
      const { payoutId } = req.params;
      const { reason } = req.body;

      const payout = await payoutService.rejectPayout(payoutId, reason);

      return successResponse(
        res,
        {
          id: payout.id,
          status: payout.status,
          rejection_reason: payout.rejection_reason,
          failed_at: payout.failed_at
        },
        'Payout rejected successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get pending payouts count (Admin only)
   * @route   GET /api/v1/payouts/pending/count
   * @access  Private (Admin)
   */
  async getPendingCount(req, res, next) {
    try {
      const count = await payoutService.getPendingCount();

      return successResponse(
        res,
        { count },
        'Pending count retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
module.exports = new PayoutController();