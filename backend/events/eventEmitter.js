/**
 * Event Emitter
 * 
 * Central event system for application-wide events.
 * Allows decoupled communication between services.
 * 
 * Location: src/events/eventEmitter.js
 */

const EventEmitter = require('events');
const logger = require('../src/shared/utils/logger');

class ApplicationEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(20); // Increase max listeners
  }

  /**
   * Emit event with error handling and logging
   * @param {string} eventName - Event name
   * @param {*} data - Event data
   */
  emitEvent(eventName, data) {
    try {
      logger.info('Event emitted', {
        event: eventName,
        data: logger.sanitize(data)
      });

      this.emit(eventName, data);
    } catch (error) {
      logger.error('Error emitting event', {
        event: eventName,
        error: error.message
      });
    }
  }

  /**
   * Register event handler with error handling
   * @param {string} eventName - Event name
   * @param {Function} handler - Event handler
   */
  registerHandler(eventName, handler) {
    this.on(eventName, async (data) => {
      try {
        logger.debug('Event handler triggered', {
          event: eventName,
          handler: handler.name
        });

        await handler(data);

        logger.debug('Event handler completed', {
          event: eventName,
          handler: handler.name
        });
      } catch (error) {
        logger.error('Event handler error', {
          event: eventName,
          handler: handler.name,
          error: error.message,
          stack: error.stack
        });
      }
    });

    logger.info('Event handler registered', {
      event: eventName,
      handler: handler.name
    });
  }

  /**
   * Register one-time event handler
   * @param {string} eventName - Event name
   * @param {Function} handler - Event handler
   */
  registerOnceHandler(eventName, handler) {
    this.once(eventName, async (data) => {
      try {
        await handler(data);
      } catch (error) {
        logger.error('One-time event handler error', {
          event: eventName,
          handler: handler.name,
          error: error.message
        });
      }
    });
  }

  /**
   * Remove all handlers for an event
   * @param {string} eventName - Event name
   */
  removeAllHandlers(eventName) {
    this.removeAllListeners(eventName);
    logger.info('All event handlers removed', { event: eventName });
  }

  /**
   * Get list of registered events
   * @returns {Array<string>} Event names
   */
  getRegisteredEvents() {
    return this.eventNames();
  }

  /**
   * Get listener count for an event
   * @param {string} eventName - Event name
   * @returns {number} Listener count
   */
  getListenerCount(eventName) {
    return this.listenerCount(eventName);
  }
}

// Create singleton instance
const appEvents = new ApplicationEventEmitter();

/**
 * Event Names - Centralized event constants
 */
const EVENT_NAMES = {
  // User events
  USER_REGISTERED: 'user.registered',
  USER_LOGGED_IN: 'user.logged_in',
  USER_LOGGED_OUT: 'user.logged_out',
  USER_PASSWORD_CHANGED: 'user.password_changed',
  USER_PROFILE_UPDATED: 'user.profile_updated',
  USER_SUSPENDED: 'user.suspended',
  USER_ACTIVATED: 'user.activated',

  // Transaction events
  TRANSACTION_CREATED: 'transaction.created',
  TRANSACTION_COMPLETED: 'transaction.completed',
  TRANSACTION_FAILED: 'transaction.failed',
  TRANSACTION_REFUNDED: 'transaction.refunded',
  TRANSACTION_CANCELLED: 'transaction.cancelled',

  // Deposit events
  DEPOSIT_REQUESTED: 'deposit.requested',
  DEPOSIT_APPROVED: 'deposit.approved',
  DEPOSIT_REJECTED: 'deposit.rejected',
  DEPOSIT_CANCELLED: 'deposit.cancelled',

  // Payout events
  PAYOUT_REQUESTED: 'payout.requested',
  PAYOUT_APPROVED: 'payout.approved',
  PAYOUT_PROCESSING: 'payout.processing',
  PAYOUT_COMPLETED: 'payout.completed',
  PAYOUT_FAILED: 'payout.failed',
  PAYOUT_CANCELLED: 'payout.cancelled',

  // Balance events
  BALANCE_CREDITED: 'balance.credited',
  BALANCE_DEBITED: 'balance.debited',
  BALANCE_LOW: 'balance.low',
  BALANCE_ADJUSTED: 'balance.adjusted',

  // Pool events
  POOL_ALLOCATED: 'pool.allocated',
  POOL_DEALLOCATED: 'pool.deallocated',
  POOL_SYNCED: 'pool.synced',
  POOL_LOW_BALANCE: 'pool.low_balance',
  POOL_CRITICAL: 'pool.critical',

  // Receipt events
  RECEIPT_GENERATED: 'receipt.generated',
  RECEIPT_PRINTED: 'receipt.printed',
  RECEIPT_EMAILED: 'receipt.emailed',

  // System events
  SYSTEM_ERROR: 'system.error',
  SYSTEM_WARNING: 'system.warning',
  GATEWAY_CONNECTED: 'gateway.connected',
  GATEWAY_DISCONNECTED: 'gateway.disconnected',
  RECONCILIATION_COMPLETED: 'reconciliation.completed',
  RECONCILIATION_FAILED: 'reconciliation.failed'
};

/**
 * Helper functions to emit common events
 */
const eventHelpers = {
  /**
   * Emit user registered event
   */
  userRegistered: (user) => {
    appEvents.emitEvent(EVENT_NAMES.USER_REGISTERED, {
      userId: user.id,
      email: user.email,
      businessName: user.business_name,
      timestamp: new Date()
    });
  },

  /**
   * Emit transaction created event
   */
  transactionCreated: (transaction) => {
    appEvents.emitEvent(EVENT_NAMES.TRANSACTION_CREATED, {
      transactionId: transaction.id,
      userId: transaction.user_id,
      type: transaction.transaction_type,
      amount: transaction.amount,
      status: transaction.status,
      timestamp: new Date()
    });
  },

  /**
   * Emit deposit approved event
   */
  depositApproved: (deposit, approvedBy) => {
    appEvents.emitEvent(EVENT_NAMES.DEPOSIT_APPROVED, {
      depositId: deposit.id,
      userId: deposit.user_id,
      amount: deposit.amount,
      approvedBy,
      timestamp: new Date()
    });
  },

  /**
   * Emit payout completed event
   */
  payoutCompleted: (payout) => {
    appEvents.emitEvent(EVENT_NAMES.PAYOUT_COMPLETED, {
      payoutId: payout.id,
      userId: payout.user_id,
      amount: payout.amount,
      timestamp: new Date()
    });
  },

  /**
   * Emit balance credited event
   */
  balanceCredited: (userId, amount, source) => {
    appEvents.emitEvent(EVENT_NAMES.BALANCE_CREDITED, {
      userId,
      amount,
      source,
      timestamp: new Date()
    });
  },

  /**
   * Emit pool low balance warning
   */
  poolLowBalance: (poolStatus) => {
    appEvents.emitEvent(EVENT_NAMES.POOL_LOW_BALANCE, {
      totalBalance: poolStatus.totalBalance,
      unallocatedBalance: poolStatus.unallocatedBalance,
      threshold: poolStatus.threshold,
      timestamp: new Date()
    });
  },

  /**
   * Emit receipt generated event
   */
  receiptGenerated: (receipt) => {
    appEvents.emitEvent(EVENT_NAMES.RECEIPT_GENERATED, {
      receiptId: receipt.id,
      receiptNumber: receipt.receipt_number,
      userId: receipt.user_id,
      total: receipt.total,
      timestamp: new Date()
    });
  },

  /**
   * Emit system error event
   */
  systemError: (error, context) => {
    appEvents.emitEvent(EVENT_NAMES.SYSTEM_ERROR, {
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date()
    });
  },

  /**
   * Emit reconciliation completed event
   */
  reconciliationCompleted: (result) => {
    appEvents.emitEvent(EVENT_NAMES.RECONCILIATION_COMPLETED, {
      ...result,
      timestamp: new Date()
    });
  }
};

module.exports = {
  appEvents,
  EVENT_NAMES,
  eventHelpers
};