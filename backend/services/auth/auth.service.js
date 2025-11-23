/**
 * Auth Service
 * 
 * Handles user authentication, registration, and password management.
 * 
 * Location: src/services/auth/authService.js
 */

const bcrypt = require('bcryptjs');
const userRepository = require('../../database/repositories/user.repository');
const balanceService = require('../balance/balance.service');
const logger = require('../../src/shared/utils/logger');
const config = require('../../src/config/environment.config');
const {
  generateTokens,
  revokeRefreshToken,
  revokeAllUserTokens
} = require('../../src/shared/middleware/auth.middleware');
const {
  UnauthorizedError,
  ConflictError,
  BadRequestError,
  NotFoundError
} = require('../../src/shared/utils/ApiError');

class AuthService {
  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} Created user with tokens
   */
  async register(userData) {
    const { email, password, business_name, phone } = userData;

    try {
      // Check if email already exists
      const existingUser = await userRepository.findByEmail(email);
      if (existingUser) {
        throw new ConflictError('Email is already registered');
      }

      // Hash password
      const password_hash = await bcrypt.hash(password, config.security.bcryptRounds);

      // Create user
      const user = await userRepository.createUser({
        email,
        password_hash,
        business_name,
        phone,
        role: 'SELLER'
      });

      // Initialize balance for user
      await balanceService.initializeBalance(user.id);

      logger.info('User registered successfully', {
        userId: user.id,
        email: user.email,
        businessName: user.business_name
      });

      // Generate tokens
      const tokens = await generateTokens(user);

      return {
        user: userRepository.sanitizeUser(user),
        ...tokens
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'register',
        email
      });
      throw error;
    }
  }

  /**
   * Login user
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} ip - User IP address
   * @returns {Promise<Object>} User with tokens
   */
  async login(email, password, ip = null) {
    try {
      // Find user by email
      const user = await userRepository.findByEmail(email);

      if (!user) {
        // Record failed attempt for rate limiting
        logger.security('Login attempt with non-existent email', {
          email,
          ip
        });
        throw new UnauthorizedError('Invalid email or password');
      }

      // Check if account is locked
      const lockStatus = await userRepository.isAccountLocked(user.id);
      if (lockStatus.locked) {
        throw new UnauthorizedError(
          `Account is locked. Please try again in ${lockStatus.remainingMinutes} minutes`
        );
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);

      if (!isPasswordValid) {
        // Record failed login attempt
        await userRepository.recordLoginAttempt(user.id, false);

        logger.security('Failed login attempt', {
          userId: user.id,
          email: user.email,
          ip
        });

        throw new UnauthorizedError('Invalid email or password');
      }

      // Check if account is suspended
      if (user.status === 'SUSPENDED') {
        logger.security('Suspended user login attempt', {
          userId: user.id,
          email: user.email,
          ip
        });
        throw new UnauthorizedError('Your account has been suspended. Please contact support.');
      }

      // Check if account is deactivated
      if (user.status === 'DEACTIVATED') {
        throw new UnauthorizedError('Your account has been deactivated');
      }

      // Record successful login
      await userRepository.recordLoginAttempt(user.id, true);

      logger.info('User logged in successfully', {
        userId: user.id,
        email: user.email,
        ip
      });

      // Generate tokens
      const tokens = await generateTokens(user);

      // Get user with balance
      const userWithBalance = await userRepository.getUserWithBalance(user.id);

      return {
        user: userRepository.sanitizeUser(userWithBalance),
        ...tokens
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'login',
        email,
        ip
      });
      throw error;
    }
  }

  /**
   * Logout user
   * @param {string} refreshToken - Refresh token to revoke
   * @returns {Promise<boolean>} Success status
   */
  async logout(refreshToken) {
    try {
      await revokeRefreshToken(refreshToken);

      logger.info('User logged out successfully', {
        token: refreshToken.substring(0, 20) + '...'
      });

      return true;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'logout'
      });
      throw error;
    }
  }

  /**
   * Logout from all devices
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async logoutAll(userId) {
    try {
      await revokeAllUserTokens(userId);

      logger.info('User logged out from all devices', {
        userId
      });

      return true;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'logoutAll',
        userId
      });
      throw error;
    }
  }

  /**
   * Refresh access token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} New tokens
   */
  async refreshToken(refreshToken) {
    try {
      // Verify refresh token is handled by middleware
      // This method just generates new tokens

      const tokenRecord = await userRepository.model.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true }
      });

      if (!tokenRecord || !tokenRecord.user) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      // Generate new tokens
      const tokens = await generateTokens(tokenRecord.user);

      // Revoke old refresh token
      await revokeRefreshToken(refreshToken);

      logger.info('Token refreshed successfully', {
        userId: tokenRecord.user.id
      });

      return tokens;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'refreshToken'
      });
      throw error;
    }
  }

  /**
   * Change password
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Updated user
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await userRepository.findByIdOrFail(userId);

      // Verify current password
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);

      if (!isPasswordValid) {
        logger.security('Failed password change attempt', {
          userId: user.id
        });
        throw new UnauthorizedError('Current password is incorrect');
      }

      // Check if new password is same as current
      const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
      if (isSamePassword) {
        throw new BadRequestError('New password must be different from current password');
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, config.security.bcryptRounds);

      // Update password
      const updatedUser = await userRepository.updatePassword(userId, newPasswordHash);

      // Revoke all tokens (force re-login)
      await revokeAllUserTokens(userId);

      logger.info('Password changed successfully', {
        userId: user.id
      });

      return updatedUser;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'changePassword',
        userId
      });
      throw error;
    }
  }

  /**
   * Request password reset
   * @param {string} email - User email
   * @returns {Promise<Object>} Reset token info
   */
  async requestPasswordReset(email) {
    try {
      const user = await userRepository.findByEmail(email);

      if (!user) {
        // Don't reveal if email exists
        logger.security('Password reset requested for non-existent email', {
          email
        });
        return {
          message: 'If the email exists, a reset link will be sent'
        };
      }

      // Generate reset token (valid for 1 hour)
      const resetToken = await this.generateResetToken(user.id);

      // TODO: Send email with reset link
      // await emailService.sendPasswordResetEmail(user.email, resetToken);

      logger.info('Password reset requested', {
        userId: user.id,
        email: user.email
      });

      return {
        message: 'If the email exists, a reset link will be sent',
        // In development, return token
        ...(config.app.isDevelopment && { resetToken })
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'requestPasswordReset',
        email
      });
      throw error;
    }
  }

  /**
   * Reset password with token
   * @param {string} resetToken - Reset token
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Success message
   */
  async resetPassword(resetToken, newPassword) {
    try {
      // Verify reset token
      const userId = await this.verifyResetToken(resetToken);

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, config.security.bcryptRounds);

      // Update password
      await userRepository.updatePassword(userId, newPasswordHash);

      // Revoke all tokens
      await revokeAllUserTokens(userId);

      // Delete reset token
      await this.deleteResetToken(resetToken);

      logger.info('Password reset successfully', {
        userId
      });

      return {
        message: 'Password reset successful. Please login with your new password.'
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'resetPassword'
      });
      throw error;
    }
  }

  /**
   * Verify email
   * @param {string} userId - User ID
   * @param {string} verificationToken - Verification token
   * @returns {Promise<Object>} Updated user
   */
  async verifyEmail(userId, verificationToken) {
    try {
      // TODO: Verify token
      // For now, just verify the email

      const user = await userRepository.verifyEmail(userId);

      logger.info('Email verified', {
        userId: user.id,
        email: user.email
      });

      return user;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'verifyEmail',
        userId
      });
      throw error;
    }
  }

  /**
   * Get current user profile
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User profile with balance
   */
  async getProfile(userId) {
    try {
      const user = await userRepository.getUserWithBalance(userId);

      if (!user) {
        throw new NotFoundError('User');
      }

      // Get balance summary
      const balanceSummary = await balanceService.getBalanceSummary(userId);

      return {
        ...userRepository.sanitizeUser(user),
        balance: balanceSummary
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getProfile',
        userId
      });
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated user
   */
  async updateProfile(userId, updateData) {
    try {
      const { business_name, phone } = updateData;

      const user = await userRepository.updateProfile(userId, {
        business_name,
        phone
      });

      logger.info('Profile updated', {
        userId: user.id
      });

      return user;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'updateProfile',
        userId
      });
      throw error;
    }
  }

  /**
   * Generate password reset token
   * @private
   */
  async generateResetToken(userId) {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store token in database (you need to create this table)
    // For now, return the token
    return token;
  }

  /**
   * Verify reset token
   * @private
   */
  async verifyResetToken(token) {
    // TODO: Implement token verification
    // For now, throw error
    throw new UnauthorizedError('Invalid or expired reset token');
  }

  /**
   * Delete reset token
   * @private
   */
  async deleteResetToken(token) {
    // TODO: Implement token deletion
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {Object} Validation result
   */
  validatePassword(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[@$!%*?&#]/.test(password);

    const isValid = 
      password.length >= minLength &&
      hasUpperCase &&
      hasLowerCase &&
      hasNumbers &&
      hasSpecialChar;

    return {
      isValid,
      errors: [
        !password.length >= minLength && `Password must be at least ${minLength} characters`,
        !hasUpperCase && 'Password must contain at least one uppercase letter',
        !hasLowerCase && 'Password must contain at least one lowercase letter',
        !hasNumbers && 'Password must contain at least one number',
        !hasSpecialChar && 'Password must contain at least one special character (@$!%*?&#)'
      ].filter(Boolean)
    };
  }
}

// Export singleton instance
module.exports = new AuthService();