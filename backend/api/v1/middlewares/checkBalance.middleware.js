/**
 * Check Balance Middleware
 * 
 * Verifies user has sufficient balance before processing transactions.
 * 
 * Location: backend/api/v1/middlewares/checkBalance.middleware.js
 */

const balanceService = require('../../../services/balance/balance.service');
const { InsufficientBalanceError } = require('../../../src/shared/utils/ApiError');
const logger = require('../../../src/shared/utils/logger');

/**
 * Check if user has sufficient balance
 * @param {number} requiredAmount - Amount to check (if null, checks req.body.amount)
 * @returns {Function} Middleware function
 * 
 * @example
 * router.post('/purchase', authenticate, checkBalance(100), controller.purchase);
 * router.post('/sale', authenticate, checkBalance(), controller.sale); // Uses req.body.amount
 */
function checkBalance(requiredAmount = null) {
  return async (req, res, next) => {
    try {
      const userId = req.userId;
      
      if (!userId) {
        return next(new Error('User ID not found in request'));
      }

      // Get amount from parameter or request body
      const amount = requiredAmount !== null 
        ? requiredAmount 
        : parseFloat(req.body.amount);

      if (!amount || amount <= 0) {
        return next(new Error('Invalid amount'));
      }

      // Check balance
      const hasSufficientBalance = await balanceService.checkSufficientBalance(
        userId,
        amount
      );

      if (!hasSufficientBalance) {
        const balance = await balanceService.getBalance(userId);
        
        logger.warn('Insufficient balance attempt', {
          userId,
          required: amount,
          available: balance.available,
          path: req.path
        });

        throw new InsufficientBalanceError(amount, balance.available);
      }

      // Attach checked amount to request for later use
      req.checkedAmount = amount;

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Check minimum balance requirement
 * Ensures user maintains a minimum balance
 * 
 * @param {number} minBalance - Minimum balance required
 * @returns {Function} Middleware function
 */
function checkMinimumBalance(minBalance = 0) {
  return async (req, res, next) => {
    try {
      const userId = req.userId;
      
      if (!userId) {
        return next(new Error('User ID not found in request'));
      }

      const balance = await balanceService.getBalance(userId);

      if (balance.available < minBalance) {
        logger.warn('Minimum balance requirement not met', {
          userId,
          available: balance.available,
          required: minBalance,
          path: req.path
        });

        throw new InsufficientBalanceError(minBalance, balance.available);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Attach user balance to request
 * Useful for controllers that need balance info
 * 
 * @returns {Function} Middleware function
 */
function attachBalance() {
  return async (req, res, next) => {
    try {
      const userId = req.userId;
      
      if (!userId) {
        return next(new Error('User ID not found in request'));
      }

      const balance = await balanceService.getBalance(userId);
      req.userBalance = balance;

      next();
    } catch (error) {
      logger.error('Failed to attach balance to request', {
        userId: req.userId,
        error: error.message
      });
      next(error);
    }
  };
}

/**
 * Check if amount is within daily transaction limit
 * 
 * @param {number} dailyLimit - Daily transaction limit
 * @returns {Function} Middleware function
 */
function checkDailyLimit(dailyLimit = 10000) {
  return async (req, res, next) => {
    try {
      const userId = req.userId;
      const amount = parseFloat(req.body.amount);

      // Get today's transaction total
      const transactionService = require('../../../services/transaction/transaction.service');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todaySummary = await transactionService.getDailySummary(userId, today);
      const todayTotal = todaySummary.totalAmount || 0;

      // Check if adding this transaction would exceed limit
      if (todayTotal + amount > dailyLimit) {
        const remaining = dailyLimit - todayTotal;
        
        logger.warn('Daily transaction limit would be exceeded', {
          userId,
          todayTotal,
          requestedAmount: amount,
          dailyLimit,
          remaining,
          path: req.path
        });

        const { TransactionLimitError } = require('../../../src/shared/utils/ApiError');
        throw new TransactionLimitError(
          dailyLimit,
          `daily transaction limit. You have $${remaining.toFixed(2)} remaining for today`
        );
      }

      // Attach info to request
      req.dailyTransactionInfo = {
        todayTotal,
        remaining: dailyLimit - (todayTotal + amount),
        limit: dailyLimit
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  checkBalance,
  checkMinimumBalance,
  attachBalance,
  checkDailyLimit
};