/**
 * Event Handlers Index
 * 
 * Registers all event handlers with the event emitter.
 * 
 * Location: src/events/handlers/index.js
 */

const { appEvents, EVENT_NAMES } = require('./eventEmitter');
const handleTransactionCreated = require('./handlers/transactionCreated');
const handleDepositApproved = require('./handlers/depositApproved');
const logger = require('../src/shared/utils/logger');

/**
 * Register all event handlers
 */
function registerEventHandlers() {
  logger.info('Registering event handlers');

  // Transaction events
  appEvents.registerHandler(
    EVENT_NAMES.TRANSACTION_CREATED,
    handleTransactionCreated
  );

  // Deposit events
  appEvents.registerHandler(
    EVENT_NAMES.DEPOSIT_APPROVED,
    handleDepositApproved
  );

  // Add more handlers here as needed
  // appEvents.registerHandler(EVENT_NAMES.PAYOUT_COMPLETED, handlePayoutCompleted);
  // appEvents.registerHandler(EVENT_NAMES.BALANCE_LOW, handleBalanceLow);
  // appEvents.registerHandler(EVENT_NAMES.POOL_CRITICAL, handlePoolCritical);

  logger.info('Event handlers registered successfully', {
    registeredEvents: appEvents.getRegisteredEvents()
  });
}

module.exports = {
  registerEventHandlers
};