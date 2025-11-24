/**
 * Receipt Service
 * 
 * Handles receipt generation and management for transactions.
 * 
 * Location: src/services/receipt/receiptService.js
 */

const receiptRepository = require('../../database/repositories/receipt.repository');
const transactionRepository = require('../../database/repositories/transaction.repository');
const userRepository = require('../../database/repositories/user.repository');
const logger = require('../../src/shared/utils/logger');
const {
  BadRequestError,
  NotFoundError
} = require('../../src/shared/utils/ApiError');

class ReceiptService {
  /**
   * Generate receipt for a transaction
   * @param {string} transactionId - Transaction ID
   * @param {Object} receiptData - Additional receipt data
   * @returns {Promise<Object>} Generated receipt
   */
  async generateReceipt(transactionId, receiptData = {}) {
    try {
      // Get transaction
      const transaction = await transactionRepository.findById(transactionId);

      if (!transaction) {
        throw new NotFoundError('Transaction');
      }

      // Check if receipt already exists
      const existing = await receiptRepository.findByTransactionId(transactionId);
      if (existing) {
        return existing; // Return existing receipt
      }

      // Get user details
      const user = await userRepository.findById(transaction.user_id);

      // Generate receipt number
      const receiptNumber = await receiptRepository.generateReceiptNumber();

      // Extract items from transaction metadata
      const items = transaction.metadata?.items || receiptData.items || [];

      // Calculate amounts
      const subtotal = parseFloat(transaction.amount);
      const tax = receiptData.tax || 0;
      const discount = receiptData.discount || 0;
      const total = subtotal + tax - discount;

      // Create receipt
      const receipt = await receiptRepository.create({
        transaction_id: transactionId,
        user_id: transaction.user_id,
        receipt_number: receiptNumber,
        items: items,
        subtotal,
        tax,
        discount,
        total,
        payment_method: receiptData.payment_method || 'Digital Wallet',
        customer_name: transaction.customer_name || receiptData.customer_name,
        customer_email: transaction.customer_email || receiptData.customer_email,
        customer_phone: receiptData.customer_phone,
        notes: receiptData.notes
      });

      logger.info('Receipt generated', {
        receiptId: receipt.id,
        receiptNumber,
        transactionId,
        total
      });

      return {
        ...receipt,
        business: {
          name: user.business_name,
          phone: user.phone,
          email: user.email
        }
      };

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'generateReceipt',
        transactionId
      });
      throw error;
    }
  }

  /**
   * Get receipt by ID
   * @param {string} receiptId - Receipt ID
   * @param {string} userId - User ID (for verification)
   * @returns {Promise<Object>} Receipt with business details
   */
  async getReceipt(receiptId, userId = null) {
    try {
      const receipt = await receiptRepository.findById(receiptId, {
        include: {
          transaction: true,
          user: {
            select: {
              business_name: true,
              phone: true,
              email: true
            }
          }
        }
      });

      if (!receipt) {
        throw new NotFoundError('Receipt');
      }

      // Verify ownership if userId provided
      if (userId && receipt.user_id !== userId) {
        throw new BadRequestError('Unauthorized to view this receipt');
      }

      return receipt;

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getReceipt',
        receiptId,
        userId
      });
      throw error;
    }
  }

  /**
   * Get receipt by receipt number
   * @param {string} receiptNumber - Receipt number
   * @returns {Promise<Object>} Receipt
   */
  async getReceiptByNumber(receiptNumber) {
    try {
      const receipt = await receiptRepository.findByReceiptNumber(receiptNumber);

      if (!receipt) {
        throw new NotFoundError('Receipt');
      }

      return receipt;

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getReceiptByNumber',
        receiptNumber
      });
      throw error;
    }
  }

  /**
   * Get receipts for user
   * @param {string} userId - User ID
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Paginated receipts
   */
  async getUserReceipts(userId, pagination = {}) {
    try {
      return await receiptRepository.findByUserId(userId, pagination);
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getUserReceipts',
        userId
      });
      throw error;
    }
  }

  /**
   * Mark receipt as printed
   * @param {string} receiptId - Receipt ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated receipt
   */
  async markAsPrinted(receiptId, userId) {
    try {
      const receipt = await receiptRepository.findById(receiptId);

      if (!receipt) {
        throw new NotFoundError('Receipt');
      }

      if (receipt.user_id !== userId) {
        throw new BadRequestError('Unauthorized to update this receipt');
      }

      const updated = await receiptRepository.markAsPrinted(receiptId);

      logger.info('Receipt marked as printed', {
        receiptId,
        receiptNumber: receipt.receipt_number
      });

      return updated;

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'markAsPrinted',
        receiptId,
        userId
      });
      throw error;
    }
  }

  /**
   * Email receipt to customer
   * @param {string} receiptId - Receipt ID
   * @param {string} userId - User ID
   * @param {string} email - Customer email (optional, uses receipt email if not provided)
   * @returns {Promise<boolean>} Success status
   */
  async emailReceipt(receiptId, userId, email = null) {
    try {
      const receipt = await this.getReceipt(receiptId, userId);

      const recipientEmail = email || receipt.customer_email;

      if (!recipientEmail) {
        throw new BadRequestError('No email address provided');
      }

      // TODO: Implement email sending
      // await emailService.sendReceipt(recipientEmail, receipt);

      // Mark as emailed
      await receiptRepository.markAsEmailed(receiptId);

      logger.info('Receipt emailed', {
        receiptId,
        receiptNumber: receipt.receipt_number,
        email: recipientEmail
      });

      return true;

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'emailReceipt',
        receiptId,
        userId
      });
      throw error;
    }
  }

  /**
   * Get today's receipts
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Today's receipts
   */
  async getTodayReceipts(userId) {
    try {
      return await receiptRepository.getTodayReceipts(userId);
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getTodayReceipts',
        userId
      });
      throw error;
    }
  }

  /**
   * Search receipts
   * @param {string} userId - User ID
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Matching receipts
   */
  async searchReceipts(userId, query, options = {}) {
    try {
      return await receiptRepository.search(userId, query, options);
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'searchReceipts',
        userId,
        query
      });
      throw error;
    }
  }

  /**
   * Format receipt for printing
   * @param {string} receiptId - Receipt ID
   * @returns {Promise<Object>} Formatted receipt data
   */
  async formatForPrint(receiptId) {
    try {
      const receipt = await this.getReceipt(receiptId);

      return {
        receiptNumber: receipt.receipt_number,
        date: receipt.created_at,
        business: {
          name: receipt.user.business_name,
          phone: receipt.user.phone,
          email: receipt.user.email
        },
        customer: {
          name: receipt.customer_name,
          email: receipt.customer_email,
          phone: receipt.customer_phone
        },
        items: receipt.items,
        subtotal: parseFloat(receipt.subtotal),
        tax: parseFloat(receipt.tax),
        discount: parseFloat(receipt.discount),
        total: parseFloat(receipt.total),
        paymentMethod: receipt.payment_method,
        notes: receipt.notes
      };

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'formatForPrint',
        receiptId
      });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new ReceiptService();