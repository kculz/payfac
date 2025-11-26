/**
 * Receipt Routes
 * 
 * Defines all receipt-related routes.
 * 
 * Location: backend/api/v1/routes/receipt.route.js
 */

const express = require('express');
const receiptController = require('../controllers/receipt.controller');
const { authenticate, requireAdmin } = require('../../../src/shared/middleware/auth.middleware');
const { validateRequest, validateUuidParam, commonSchemas } = require('../../../src/shared/middleware/validation.middleware');
const { asyncHandler } = require('../../../src/shared/middleware/errorHandler.middleware');
const Joi = require('joi');

const router = express.Router();

// ============================================================================
// RECEIPT GENERATION ROUTES
// ============================================================================

/**
 * @route   POST /api/v1/receipts/generate/:transactionId
 * @desc    Generate receipt for transaction
 * @access  Private
 */
router.post(
  '/generate/:transactionId',
  authenticate,
  validateUuidParam('transactionId'),
  validateRequest(Joi.object({
    items: Joi.array().items(
      Joi.object({
        name: Joi.string().required().max(255),
        description: Joi.string().optional().max(500),
        quantity: Joi.number().positive().required(),
        price: commonSchemas.amount.required(),
        tax_rate: Joi.number().min(0).max(100).default(0)
      })
    ).min(1).required().messages({
      'array.min': 'At least one item is required',
      'any.required': 'Items are required'
    }),
    subtotal: commonSchemas.amount.optional(),
    tax: commonSchemas.amount.optional().default(0),
    discount: commonSchemas.amount.optional().default(0),
    total: commonSchemas.amount.required(),
    payment_method: Joi.string().required().max(100).messages({
      'string.empty': 'Payment method is required',
      'string.max': 'Payment method must not exceed 100 characters'
    }),
    customer_name: Joi.string().optional().max(255),
    customer_email: commonSchemas.email.optional(),
    customer_phone: Joi.string().optional().max(20),
    notes: Joi.string().optional().max(1000),
    business: Joi.object({
      name: Joi.string().optional().max(255),
      address: Joi.string().optional().max(500),
      phone: Joi.string().optional().max(20),
      email: commonSchemas.email.optional(),
      tax_number: Joi.string().optional().max(50)
    }).optional()
  })),
  asyncHandler(receiptController.generateReceipt.bind(receiptController))
);

// ============================================================================
// RECEIPT RETRIEVAL ROUTES
// ============================================================================

/**
 * @route   GET /api/v1/receipts
 * @desc    Get user receipts
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  validateRequest(Joi.object({
    page: commonSchemas.pagination.page,
    limit: commonSchemas.pagination.limit
  }), 'query'),
  asyncHandler(receiptController.getUserReceipts.bind(receiptController))
);

/**
 * @route   GET /api/v1/receipts/:receiptId
 * @desc    Get receipt by ID
 * @access  Private
 */
router.get(
  '/:receiptId',
  authenticate,
  validateUuidParam('receiptId'),
  asyncHandler(receiptController.getReceipt.bind(receiptController))
);

/**
 * @route   GET /api/v1/receipts/number/:receiptNumber
 * @desc    Get receipt by receipt number
 * @access  Private
 */
router.get(
  '/number/:receiptNumber',
  authenticate,
  validateRequest(Joi.object({
    receiptNumber: Joi.string().required().pattern(/^[A-Z0-9\-]+$/).messages({
      'string.pattern.base': 'Receipt number must contain only letters, numbers, and hyphens',
      'any.required': 'Receipt number is required'
    })
  }), 'params'),
  asyncHandler(receiptController.getReceiptByNumber.bind(receiptController))
);

// ============================================================================
// RECEIPT ACTIONS ROUTES
// ============================================================================

/**
 * @route   POST /api/v1/receipts/:receiptId/print
 * @desc    Mark receipt as printed
 * @access  Private
 */
router.post(
  '/:receiptId/print',
  authenticate,
  validateUuidParam('receiptId'),
  asyncHandler(receiptController.markAsPrinted.bind(receiptController))
);

/**
 * @route   POST /api/v1/receipts/:receiptId/email
 * @desc    Email receipt to customer
 * @access  Private
 */
router.post(
  '/:receiptId/email',
  authenticate,
  validateUuidParam('receiptId'),
  validateRequest(Joi.object({
    email: commonSchemas.email.optional()
  })),
  asyncHandler(receiptController.emailReceipt.bind(receiptController))
);

// ============================================================================
// RECEIPT QUERY ROUTES
// ============================================================================

/**
 * @route   GET /api/v1/receipts/today
 * @desc    Get today's receipts
 * @access  Private
 */
router.get(
  '/today',
  authenticate,
  asyncHandler(receiptController.getTodayReceipts.bind(receiptController))
);

/**
 * @route   GET /api/v1/receipts/search
 * @desc    Search receipts
 * @access  Private
 */
router.get(
  '/search',
  authenticate,
  validateRequest(Joi.object({
    query: commonSchemas.searchQuery.required(),
    limit: Joi.number().integer().min(1).max(50).default(20)
  }), 'query'),
  asyncHandler(receiptController.searchReceipts.bind(receiptController))
);

/**
 * @route   GET /api/v1/receipts/:receiptId/print-format
 * @desc    Format receipt for printing
 * @access  Private
 */
router.get(
  '/:receiptId/print-format',
  authenticate,
  validateUuidParam('receiptId'),
  asyncHandler(receiptController.getReceiptForPrint.bind(receiptController))
);

// ============================================================================
// ADMIN RECEIPT ROUTES
// ============================================================================

/**
 * @route   GET /api/v1/receipts/admin/all
 * @desc    Get all receipts (Admin only)
 * @access  Private (Admin)
 */
router.get(
  '/admin/all',
  authenticate,
  requireAdmin,
  validateRequest(Joi.object({
    page: commonSchemas.pagination.page,
    limit: commonSchemas.pagination.limit,
    startDate: commonSchemas.dateRange.startDate,
    endDate: commonSchemas.dateRange.endDate,
    userId: commonSchemas.uuid.optional()
  }), 'query'),
  asyncHandler(receiptController.getAllReceipts.bind(receiptController))
);

/**
 * @route   GET /api/v1/receipts/admin/stats
 * @desc    Get receipt statistics (Admin only)
 * @access  Private (Admin)
 */
router.get(
  '/admin/stats',
  authenticate,
  requireAdmin,
  validateRequest(Joi.object({
    startDate: commonSchemas.dateRange.startDate,
    endDate: commonSchemas.dateRange.endDate
  }), 'query'),
  asyncHandler(receiptController.getReceiptStats.bind(receiptController))
);

/**
 * @route   POST /api/v1/receipts/admin/email/:receiptId
 * @desc    Force email receipt (Admin override)
 * @access  Private (Admin)
 */
router.post(
  '/admin/email/:receiptId',
  authenticate,
  requireAdmin,
  validateUuidParam('receiptId'),
  validateRequest(Joi.object({
    email: commonSchemas.email.required().messages({
      'string.email': 'Valid email is required',
      'any.required': 'Email is required'
    })
  })),
  asyncHandler(receiptController.adminEmailReceipt.bind(receiptController))
);

module.exports = router;