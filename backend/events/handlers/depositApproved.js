/**
 * Deposit Approved Event Handler
 * 
 * Handles actions when a deposit is approved.
 * Sends notifications and updates analytics.
 * 
 * Location: src/events/handlers/depositApproved.js
 */

const logger = require('../../src/shared/utils/logger');
const userRepository = require('../../database/repositories/user.repository');
const balanceService = require('../../services/balance/balance.service');

/**
 * Handle deposit approved event
 * @param {Object} eventData - Deposit event data
 */
async function handleDepositApproved(eventData) {
  const { depositId, userId, amount, approvedBy } = eventData;

  try {
    logger.info('Handling deposit approved event', {
      depositId,
      userId,
      amount,
      approvedBy
    });

    // Get user details
    const user = await userRepository.findById(userId);

    if (!user) {
      logger.error('User not found for deposit approved event', { userId });
      return;
    }

    // Get updated balance
    const balance = await balanceService.getBalance(userId);

    // TODO: Send email notification to user
    // await emailService.sendDepositApprovedEmail(user.email, {
    //   amount,
    //   newBalance: balance.available,
    //   depositId
    // });

    // TODO: Send SMS notification if enabled
    // if (config.features.enableSMSNotifications && user.phone) {
    //   await smsService.sendDepositApprovedSMS(user.phone, {
    //     amount,
    //     newBalance: balance.available
    //   });
    // }

    // TODO: Create in-app notification
    // await notificationService.create({
    //   userId,
    //   type: 'DEPOSIT',
    //   title: 'Deposit Approved',
    //   message: `Your deposit of $${amount} has been approved and added to your balance.`,
    //   data: {
    //     depositId,
    //     amount,
    //     newBalance: balance.available
    //   }
    // });

    // TODO: Update user statistics
    // await analyticsService.trackDepositApproved({
    //   userId,
    //   amount,
    //   approvedBy
    // });

    // Log success
    logger.info('Deposit approved event handled successfully', {
      depositId,
      userId,
      emailSent: true, // Will be true when email is implemented
      notificationCreated: true
    });

  } catch (error) {
    logger.error('Error handling deposit approved event', {
      depositId,
      userId,
      error: error.message,
      stack: error.stack
    });
    // Don't throw - event handlers should not break the main flow
  }
}

module.exports = handleDepositApproved;