/**
 * Receipt Repository
 * 
 * Handles database operations for receipts.
 * 
 * Location: src/database/repositories/receiptRepository.js
 */

const BaseRepository = require('./base.repository');
const logger = require('../../shared/utils/logger');

class ReceiptRepository extends BaseRepository {
  constructor() {
    super('receipt');
  }

  /**
   * Generate unique receipt number
   * @returns {Promise<string>} Receipt number
   */
  async generateReceiptNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Get count of receipts today
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));
    
    const count = await this.count({
      created_at: {
        gte: startOfDay,
        lte: endOfDay
      }
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `RCP${year}${month}${day}${sequence}`;
  }

  /**
   * Find receipts by user ID
   * @param {string} userId - User ID
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Paginated receipts
   */
  async findByUserId(userId, pagination = {}) {
    return this.paginate(
      { user_id: userId },
      {
        ...pagination,
        orderBy: { created_at: 'desc' },
        include: {
          transaction: {
            select: {
              id: true,
              transaction_type: true,
              status: true,
              gateway_transaction_id: true
            }
          }
        }
      }
    );
  }

  /**
   * Find receipt by receipt number
   * @param {string} receiptNumber - Receipt number
   * @returns {Promise<Object|null>} Receipt or null
   */
  async findByReceiptNumber(receiptNumber) {
    return this.findOne(
      { receipt_number: receiptNumber },
      {
        include: {
          transaction: true,
          user: {
            select: {
              id: true,
              email: true,
              business_name: true,
              phone: true
            }
          }
        }
      }
    );
  }

  /**
   * Find receipt by transaction ID
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object|null>} Receipt or null
   */
  async findByTransactionId(transactionId) {
    return this.findOne(
      { transaction_id: transactionId },
      {
        include: {
          user: {
            select: {
              business_name: true,
              phone: true,
              email: true
            }
          }
        }
      }
    );
  }

  /**
   * Mark receipt as printed
   * @param {string} receiptId - Receipt ID
   * @returns {Promise<Object>} Updated receipt
   */
  async markAsPrinted(receiptId) {
    return this.update(receiptId, {
      printed_at: new Date()
    });
  }

  /**
   * Mark receipt as emailed
   * @param {string} receiptId - Receipt ID
   * @returns {Promise<Object>} Updated receipt
   */
  async markAsEmailed(receiptId) {
    return this.update(receiptId, {
      emailed_at: new Date()
    });
  }

  /**
   * Get receipts created today
   * @param {string} userId - User ID (optional)
   * @returns {Promise<Array>} Receipts
   */
  async getTodayReceipts(userId = null) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const where = {
      created_at: {
        gte: startOfDay,
        lte: endOfDay
      }
    };

    if (userId) {
      where.user_id = userId;
    }

    return this.findMany(where, {
      orderBy: { created_at: 'desc' }
    });
  }

  /**
   * Search receipts
   * @param {string} userId - User ID
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Matching receipts
   */
  async search(userId, query, options = {}) {
    const where = {
      user_id: userId,
      OR: [
        { receipt_number: { contains: query, mode: 'insensitive' } },
        { customer_name: { contains: query, mode: 'insensitive' } },
        { customer_email: { contains: query, mode: 'insensitive' } }
      ]
    };

    return this.findMany(where, {
      take: options.limit || 20,
      orderBy: { created_at: 'desc' }
    });
  }
}

// Export singleton instance
module.exports = new ReceiptRepository();