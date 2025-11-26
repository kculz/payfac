/**
 * Receipt Controller
 * 
 * Handles HTTP requests for receipt operations.
 * 
 * Location: backend/api/v1/controllers/receipt.controller.js
 */

const receiptService = require('../../../services/receipt/receipt.service');
const receiptRepository = require('../../../database/repositories/receipt.repository');
const { successResponse, createdResponse } = require('../../../src/shared/utils/response');
const { BadRequestError, NotFoundError } = require('../../../src/shared/utils/ApiError');

class ReceiptController {
  /**
   * @desc    Generate receipt for transaction
   * @route   POST /api/v1/receipts/generate/:transactionId
   * @access  Private
   */
  async generateReceipt(req, res, next) {
    try {
      const userId = req.userId;
      const { transactionId } = req.params;
      const receiptData = req.body;

      const receipt = await receiptService.generateReceipt(transactionId, receiptData);

      return createdResponse(
        res,
        {
          id: receipt.id,
          receipt_number: receipt.receipt_number,
          transaction_id: receipt.transaction_id,
          items: receipt.items,
          subtotal: parseFloat(receipt.subtotal),
          tax: parseFloat(receipt.tax),
          discount: parseFloat(receipt.discount),
          total: parseFloat(receipt.total),
          payment_method: receipt.payment_method,
          customer_name: receipt.customer_name,
          customer_email: receipt.customer_email,
          customer_phone: receipt.customer_phone,
          notes: receipt.notes,
          business: receipt.business,
          createdAt: receipt.created_at
        },
        'Receipt generated successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get receipt by ID
   * @route   GET /api/v1/receipts/:receiptId
   * @access  Private
   */
  async getReceipt(req, res, next) {
    try {
      const userId = req.userId;
      const { receiptId } = req.params;

      const receipt = await receiptService.getReceipt(receiptId, userId);

      return successResponse(
        res,
        {
          id: receipt.id,
          receipt_number: receipt.receipt_number,
          transaction_id: receipt.transaction_id,
          items: receipt.items,
          subtotal: parseFloat(receipt.subtotal),
          tax: parseFloat(receipt.tax),
          discount: parseFloat(receipt.discount),
          total: parseFloat(receipt.total),
          payment_method: receipt.payment_method,
          customer_name: receipt.customer_name,
          customer_email: receipt.customer_email,
          customer_phone: receipt.customer_phone,
          notes: receipt.notes,
          business: {
            name: receipt.user.business_name,
            phone: receipt.user.phone,
            email: receipt.user.email
          },
          printed_at: receipt.printed_at,
          emailed_at: receipt.emailed_at,
          createdAt: receipt.created_at
        },
        'Receipt retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get receipt by receipt number
   * @route   GET /api/v1/receipts/number/:receiptNumber
   * @access  Private
   */
  async getReceiptByNumber(req, res, next) {
    try {
      const { receiptNumber } = req.params;

      const receipt = await receiptService.getReceiptByNumber(receiptNumber);

      return successResponse(
        res,
        {
          id: receipt.id,
          receipt_number: receipt.receipt_number,
          transaction_id: receipt.transaction_id,
          items: receipt.items,
          subtotal: parseFloat(receipt.subtotal),
          tax: parseFloat(receipt.tax),
          discount: parseFloat(receipt.discount),
          total: parseFloat(receipt.total),
          payment_method: receipt.payment_method,
          customer: {
            name: receipt.customer_name,
            email: receipt.customer_email,
            phone: receipt.customer_phone
          },
          business: {
            name: receipt.user.business_name,
            phone: receipt.user.phone,
            email: receipt.user.email
          },
          createdAt: receipt.created_at
        },
        'Receipt retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get user receipts
   * @route   GET /api/v1/receipts
   * @access  Private
   */
  async getUserReceipts(req, res, next) {
    try {
      const userId = req.userId;
      const { page = 1, limit = 20 } = req.query;

      const receipts = await receiptService.getUserReceipts(userId, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      return successResponse(
        res,
        receipts,
        'Receipts retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Mark receipt as printed
   * @route   POST /api/v1/receipts/:receiptId/print
   * @access  Private
   */
  async markAsPrinted(req, res, next) {
    try {
      const userId = req.userId;
      const { receiptId } = req.params;

      const receipt = await receiptService.markAsPrinted(receiptId, userId);

      return successResponse(
        res,
        {
          id: receipt.id,
          receipt_number: receipt.receipt_number,
          printed_at: receipt.printed_at
        },
        'Receipt marked as printed'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Email receipt to customer
   * @route   POST /api/v1/receipts/:receiptId/email
   * @access  Private
   */
  async emailReceipt(req, res, next) {
    try {
      const userId = req.userId;
      const { receiptId } = req.params;
      const { email } = req.body;

      await receiptService.emailReceipt(receiptId, userId, email);

      return successResponse(
        res,
        null,
        'Receipt emailed successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get today's receipts
   * @route   GET /api/v1/receipts/today
   * @access  Private
   */
  async getTodayReceipts(req, res, next) {
    try {
      const userId = req.userId;

      const receipts = await receiptService.getTodayReceipts(userId);

      return successResponse(
        res,
        receipts,
        'Today\'s receipts retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Search receipts
   * @route   GET /api/v1/receipts/search
   * @access  Private
   */
  async searchReceipts(req, res, next) {
    try {
      const userId = req.userId;
      const { query, limit = 20 } = req.query;

      const receipts = await receiptService.searchReceipts(
        userId,
        query,
        { limit: parseInt(limit) }
      );

      return successResponse(
        res,
        receipts,
        'Search results retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Format receipt for printing
   * @route   GET /api/v1/receipts/:receiptId/print-format
   * @access  Private
   */
  async getReceiptForPrint(req, res, next) {
    try {
      const { receiptId } = req.params;

      const receiptData = await receiptService.formatForPrint(receiptId);

      return successResponse(
        res,
        receiptData,
        'Receipt formatted for printing'
      );
    } catch (error) {
      next(error);
    }
  }

  // ============================================================================
  // ADMIN METHODS
  // ============================================================================

  /**
   * @desc    Get all receipts (Admin only)
   * @route   GET /api/v1/receipts/admin/all
   * @access  Private (Admin)
   */
  async getAllReceipts(req, res, next) {
    try {
      const { page = 1, limit = 20, startDate, endDate, userId } = req.query;

      const filters = {
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        userId
      };

      const pagination = {
        page: parseInt(page),
        limit: parseInt(limit)
      };

      const receipts = await receiptRepository.findAll(filters, pagination);

      return successResponse(
        res,
        receipts,
        'All receipts retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get receipt statistics (Admin only)
   * @route   GET /api/v1/receipts/admin/stats
   * @access  Private (Admin)
   */
  async getReceiptStats(req, res, next) {
    try {
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      const stats = await receiptRepository.getAdminStats(start, end);

      return successResponse(
        res,
        stats,
        'Receipt statistics retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Force email receipt (Admin override)
   * @route   POST /api/v1/receipts/admin/email/:receiptId
   * @access  Private (Admin)
   */
  async adminEmailReceipt(req, res, next) {
    try {
      const adminId = req.userId;
      const { receiptId } = req.params;
      const { email } = req.body;

      // Get receipt first to verify it exists
      const receipt = await receiptRepository.findById(receiptId);

      if (!receipt) {
        throw new NotFoundError('Receipt');
      }

      // Use the email service to send the receipt
      const emailService = require('../../../services/email/email.service');
      await emailService.sendReceiptEmail(receipt, email, adminId);

      // Update receipt emailed_at timestamp
      await receiptRepository.updateEmailedAt(receiptId);

      return successResponse(
        res,
        {
          receipt_id: receiptId,
          receipt_number: receipt.receipt_number,
          email_sent_to: email,
          sent_by_admin: adminId
        },
        'Receipt emailed successfully (admin override)'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get receipt analytics (Admin only)
   * @route   GET /api/v1/receipts/admin/analytics
   * @access  Private (Admin)
   */
  async getReceiptAnalytics(req, res, next) {
    try {
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      const analytics = await receiptRepository.getAnalytics(start, end);

      return successResponse(
        res,
        analytics,
        'Receipt analytics retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get receipts by date range (Admin only)
   * @route   GET /api/v1/receipts/admin/by-date
   * @access  Private (Admin)
   */
  async getReceiptsByDateRange(req, res, next) {
    try {
      const { startDate, endDate, page = 1, limit = 50 } = req.query;

      if (!startDate || !endDate) {
        throw new BadRequestError('Both startDate and endDate are required');
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      const receipts = await receiptRepository.findByDateRange(start, end, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      return successResponse(
        res,
        receipts,
        'Receipts by date range retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
module.exports = new ReceiptController();