/**
 * Auth Routes
 * 
 * Defines all authentication-related routes.
 * 
 * Location: src/api/v1/routes/auth.routes.js
 */

const express = require('express');
const authController = require('../controllers/auth.controller');
const { authenticate, verifyRefreshToken, rateLimitAuth } = require('../../../src/shared/middleware/auth.middleware');
const { validateRequest } = require('../../../src/shared/middleware/validation.middleware');
const { asyncHandler } = require('../../../src/shared/middleware/errorHandler.middleware');
const authValidators = require('../validators/auth.validator');

const router = express.Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  rateLimitAuth(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  validateRequest(authValidators.register),
  asyncHandler(authController.register.bind(authController))
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  rateLimitAuth(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  validateRequest(authValidators.login),
  asyncHandler(authController.login.bind(authController))
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout current session
 * @access  Private
 */
router.post(
  '/logout',
  authenticate,
  validateRequest(authValidators.logout),
  asyncHandler(authController.logout.bind(authController))
);

/**
 * @route   POST /api/v1/auth/logout-all
 * @desc    Logout from all devices
 * @access  Private
 */
router.post(
  '/logout-all',
  authenticate,
  asyncHandler(authController.logoutAll.bind(authController))
);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public (requires refresh token)
 */
router.post(
  '/refresh',
  validateRequest(authValidators.refreshToken),
  verifyRefreshToken,
  asyncHandler(authController.refreshToken.bind(authController))
);

/**
 * @route   GET /api/v1/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get(
  '/profile',
  authenticate,
  asyncHandler(authController.getProfile.bind(authController))
);

/**
 * @route   PUT /api/v1/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  '/profile',
  authenticate,
  validateRequest(authValidators.updateProfile),
  asyncHandler(authController.updateProfile.bind(authController))
);

/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Change password
 * @access  Private
 */
router.post(
  '/change-password',
  authenticate,
  validateRequest(authValidators.changePassword),
  asyncHandler(authController.changePassword.bind(authController))
);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post(
  '/forgot-password',
  rateLimitAuth(3, 60 * 60 * 1000), // 3 attempts per hour
  validateRequest(authValidators.forgotPassword),
  asyncHandler(authController.forgotPassword.bind(authController))
);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post(
  '/reset-password',
  rateLimitAuth(3, 60 * 60 * 1000), // 3 attempts per hour
  validateRequest(authValidators.resetPassword),
  asyncHandler(authController.resetPassword.bind(authController))
);

/**
 * @route   POST /api/v1/auth/verify-email
 * @desc    Verify email address
 * @access  Private
 */
router.post(
  '/verify-email',
  authenticate,
  validateRequest(authValidators.verifyEmail),
  asyncHandler(authController.verifyEmail.bind(authController))
);

module.exports = router;