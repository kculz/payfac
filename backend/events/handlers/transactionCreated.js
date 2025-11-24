/**
 * Transaction Created Event Handler
 * 
 * Handles actions when a transaction is created.
 * 
 * Location: src/events/handlers/transactionCreated.js
 */

const logger = require('../../src/shared/utils/logger');
const receiptService = require('../../services/receipt/receipt.service');

/**
 * Handle transaction created event
 * @param {Object} eventData - Transaction event data
 */
async function handleTransactionCreated(eventData) {
  const { transactionId, userId, type, amount, status } = eventData;

  try {
    logger.info('Handling transaction created event', {
      transactionId,
      userId,
      type,
      status
    });

    // Auto-generate receipt for completed sales
    if (type === 'SALE' && status === 'COMPLETED') {
      try {
        await receiptService.generateReceipt(transactionId);
        logger.info('Receipt auto-generated for transaction', { transactionId });
      } catch (error) {
        // Don't fail if receipt generation fails
        logger.error('Failed to auto-generate receipt', {
          transactionId,
          error: error.message
        });
      }
    }

    // TODO: Send notification to user
    // await notificationService.sendTransactionNotification(userId, {
    //   type,
    //   amount,
    //   status
    // });

    // TODO: Update analytics
    // await analyticsService.trackTransaction({
    //   userId,
    //   type,
    //   amount
    // });

    logger.info('Transaction created event handled successfully', {
      transactionId
    });

  } catch (error) {
    logger.error('Error handling transaction created event', {
      transactionId,
      error: error.message,
      stack: error.stack
    });
    // Don't throw - event handlers should not break the main flow
  }
}

module.exports = handleTransactionCreated;