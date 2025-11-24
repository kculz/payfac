/**
 * Auth Controller
 * 
 * Handles HTTP requests for authentication endpoints.
 * 
 * Location: src/api/v1/controllers/auth.controller.js
 */

const authService = require('../../../services/auth/auth.service');
const { successResponse, createdResponse } = require('../../../src/shared/utils/response');

class AuthController {
  /**
   * @desc    Register a new user
   * @route   POST /api/v1/auth/register
   * @access  Public
   */
  async register(req, res, next) {
    try {
      const { email, password, business_name, phone } = req.body;

      const result = await authService.register({
        email,
        password,
        business_name,
        phone
      });

      return createdResponse(
        res,
        result,
        'Registration successful. Welcome!'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Login user
   * @route   POST /api/v1/auth/login
   * @access  Public
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const ip = req.ip || req.connection.remoteAddress;

      const result = await authService.login(email, password, ip);

      return successResponse(
        res,
        result,
        'Login successful'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Logout user
   * @route   POST /api/v1/auth/logout
   * @access  Private
   */
  async logout(req, res, next) {
    try {
      const { refreshToken } = req.body;

      await authService.logout(refreshToken);

      return successResponse(
        res,
        null,
        'Logout successful'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Logout from all devices
   * @route   POST /api/v1/auth/logout-all
   * @access  Private
   */
  async logoutAll(req, res, next) {
    try {
      const userId = req.userId;

      await authService.logoutAll(userId);

      return successResponse(
        res,
        null,
        'Logged out from all devices successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Refresh access token
   * @route   POST /api/v1/auth/refresh
   * @access  Public (requires refresh token)
   */
  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;

      const tokens = await authService.refreshToken(refreshToken);

      return successResponse(
        res,
        tokens,
        'Token refreshed successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get current user profile
   * @route   GET /api/v1/auth/profile
   * @access  Private
   */
  async getProfile(req, res, next) {
    try {
      const userId = req.userId;

      const profile = await authService.getProfile(userId);

      return successResponse(
        res,
        profile,
        'Profile retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Update user profile
   * @route   PUT /api/v1/auth/profile
   * @access  Private
   */
  async updateProfile(req, res, next) {
    try {
      const userId = req.userId;
      const { business_name, phone } = req.body;

      const updatedUser = await authService.updateProfile(userId, {
        business_name,
        phone
      });

      return successResponse(
        res,
        updatedUser,
        'Profile updated successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Change password
   * @route   POST /api/v1/auth/change-password
   * @access  Private
   */
  async changePassword(req, res, next) {
    try {
      const userId = req.userId;
      const { currentPassword, newPassword } = req.body;

      await authService.changePassword(userId, currentPassword, newPassword);

      return successResponse(
        res,
        null,
        'Password changed successfully. Please login again.'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Request password reset
   * @route   POST /api/v1/auth/forgot-password
   * @access  Public
   */
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      const result = await authService.requestPasswordReset(email);

      return successResponse(
        res,
        result,
        'If the email exists, a reset link has been sent'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Reset password with token
   * @route   POST /api/v1/auth/reset-password
   * @access  Public
   */
  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;

      const result = await authService.resetPassword(token, newPassword);

      return successResponse(
        res,
        result,
        'Password reset successful'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Verify email
   * @route   POST /api/v1/auth/verify-email
   * @access  Private
   */
  async verifyEmail(req, res, next) {
    try {
      const userId = req.userId;
      const { token } = req.body;

      const user = await authService.verifyEmail(userId, token);

      return successResponse(
        res,
        user,
        'Email verified successfully'
      );
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
module.exports = new AuthController();