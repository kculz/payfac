/**
 * Email Service
 * 
 * Handles all email sending using Nodemailer and Handlebars templates.
 * Provides methods for sending various types of emails (auth, transactions, etc.)
 * 
 * Location: backend/services/notifications/email.service.js
 */

const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const config = require('../../src/config/environment.config');
const logger = require('../../src/shared/utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.templatesCache = new Map();
    this.initialize();
  }

  /**
   * Initialize email transporter
   */
  initialize() {
    if (!config.email.enabled) {
      logger.warn('Email service is disabled');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: {
          user: config.email.auth.user,
          pass: config.email.auth.pass
        }
      });

      logger.info('Email service initialized', {
        host: config.email.host,
        port: config.email.port,
        from: config.email.from.email
      });
    } catch (error) {
      logger.error('Failed to initialize email service', {
        error: error.message
      });
    }
  }

  /**
   * Verify email transporter connection
   * @returns {Promise<boolean>}
   */
  async verifyConnection() {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      logger.info('Email transporter verified successfully');
      return true;
    } catch (error) {
      logger.error('Email transporter verification failed', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Load and compile email template
   * @param {string} templateName - Template file name (without .hbs extension)
   * @returns {Promise<Function>} Compiled template function
   */
  async loadTemplate(templateName) {
    // Check cache first
    if (this.templatesCache.has(templateName)) {
      return this.templatesCache.get(templateName);
    }

    try {
      const templatePath = path.join(
        __dirname,
        '../../templates/emails',
        `${templateName}.hbs`
      );

      const templateSource = await fs.readFile(templatePath, 'utf-8');
      const compiledTemplate = handlebars.compile(templateSource);

      // Cache the compiled template
      this.templatesCache.set(templateName, compiledTemplate);

      return compiledTemplate;
    } catch (error) {
      logger.error('Failed to load email template', {
        templateName,
        error: error.message
      });
      throw new Error(`Email template '${templateName}' not found`);
    }
  }

  /**
   * Send email with template
   * @param {Object} options - Email options
   * @returns {Promise<Object>} Send result
   */
  async sendEmail(options) {
    const {
      to,
      subject,
      template,
      context = {},
      attachments = []
    } = options;

    if (!config.email.enabled) {
      logger.warn('Email not sent - service disabled', { to, subject });
      return { success: false, message: 'Email service disabled' };
    }

    if (!this.transporter) {
      throw new Error('Email transporter not initialized');
    }

    try {
      // Load and compile template
      const compiledTemplate = await this.loadTemplate(template);
      const html = compiledTemplate(context);

      // Prepare email options
      const mailOptions = {
        from: {
          name: config.email.from.name,
          address: config.email.from.email
        },
        to,
        subject,
        html,
        attachments
      };

      // Send email
      const info = await this.transporter.sendMail(mailOptions);

      logger.info('Email sent successfully', {
        to,
        subject,
        messageId: info.messageId,
        template
      });

      return {
        success: true,
        messageId: info.messageId,
        response: info.response
      };
    } catch (error) {
      logger.error('Failed to send email', {
        to,
        subject,
        template,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Send welcome email after registration
   * @param {Object} user - User object
   * @returns {Promise<Object>}
   */
  async sendWelcomeEmail(user) {
    return this.sendEmail({
      to: user.email,
      subject: 'Welcome to Payment Facilitator Platform',
      template: 'auth/welcome',
      context: {
        userName: user.business_name,
        email: user.email,
        loginUrl: `${config.app.frontendUrl}/login`,
        dashboardUrl: `${config.app.frontendUrl}/dashboard`,
        supportEmail: config.email.from.email,
        year: new Date().getFullYear()
      }
    });
  }

  /**
   * Send email verification email
   * @param {Object} user - User object
   * @param {string} verificationToken - Verification token
   * @returns {Promise<Object>}
   */
  async sendEmailVerification(user, verificationToken) {
    const verificationUrl = `${config.app.frontendUrl}/verify-email?token=${verificationToken}`;

    return this.sendEmail({
      to: user.email,
      subject: 'Verify Your Email Address',
      template: 'auth/verify-email',
      context: {
        userName: user.business_name,
        verificationUrl,
        expiryHours: 24,
        supportEmail: config.email.from.email,
        year: new Date().getFullYear()
      }
    });
  }

  /**
   * Send password reset email
   * @param {Object} user - User object
   * @param {string} resetToken - Password reset token
   * @returns {Promise<Object>}
   */
  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${config.app.frontendUrl}/reset-password?token=${resetToken}`;

    return this.sendEmail({
      to: user.email,
      subject: 'Reset Your Password',
      template: 'auth/password-reset',
      context: {
        userName: user.business_name,
        resetUrl,
        expiryHours: 1,
        supportEmail: config.email.from.email,
        year: new Date().getFullYear()
      }
    });
  }

  /**
   * Send password changed confirmation email
   * @param {Object} user - User object
   * @returns {Promise<Object>}
   */
  async sendPasswordChangedEmail(user) {
    return this.sendEmail({
      to: user.email,
      subject: 'Your Password Has Been Changed',
      template: 'auth/password-changed',
      context: {
        userName: user.business_name,
        changeTime: new Date().toLocaleString(),
        loginUrl: `${config.app.frontendUrl}/login`,
        supportEmail: config.email.from.email,
        year: new Date().getFullYear()
      }
    });
  }

  /**
   * Send login alert email (suspicious login)
   * @param {Object} user - User object
   * @param {Object} loginDetails - Login details (IP, location, device)
   * @returns {Promise<Object>}
   */
  async sendLoginAlertEmail(user, loginDetails) {
    return this.sendEmail({
      to: user.email,
      subject: 'New Login to Your Account',
      template: 'auth/login-alert',
      context: {
        userName: user.business_name,
        loginTime: new Date().toLocaleString(),
        ipAddress: loginDetails.ip,
        location: loginDetails.location || 'Unknown',
        device: loginDetails.device || 'Unknown',
        changePasswordUrl: `${config.app.frontendUrl}/change-password`,
        supportEmail: config.email.from.email,
        year: new Date().getFullYear()
      }
    });
  }

  /**
   * Send account locked email
   * @param {Object} user - User object
   * @param {number} lockDurationMinutes - Lock duration in minutes
   * @returns {Promise<Object>}
   */
  async sendAccountLockedEmail(user, lockDurationMinutes) {
    return this.sendEmail({
      to: user.email,
      subject: 'Your Account Has Been Temporarily Locked',
      template: 'auth/account-locked',
      context: {
        userName: user.business_name,
        lockDuration: lockDurationMinutes,
        supportEmail: config.email.from.email,
        year: new Date().getFullYear()
      }
    });
  }

  /**
   * Send transaction receipt email
   * @param {Object} user - User object
   * @param {Object} transaction - Transaction object
   * @returns {Promise<Object>}
   */
  async sendTransactionReceiptEmail(user, transaction) {
    return this.sendEmail({
      to: user.email,
      subject: `Transaction Receipt - ${transaction.id}`,
      template: 'transactions/receipt',
      context: {
        userName: user.business_name,
        transactionId: transaction.id,
        transactionType: transaction.transaction_type,
        amount: parseFloat(transaction.amount).toFixed(2),
        currency: transaction.currency || 'USD',
        status: transaction.status,
        description: transaction.description,
        date: new Date(transaction.created_at).toLocaleString(),
        viewUrl: `${config.app.frontendUrl}/transactions/${transaction.id}`,
        supportEmail: config.email.from.email,
        year: new Date().getFullYear()
      }
    });
  }

  /**
   * Send deposit approved email
   * @param {Object} user - User object
   * @param {Object} deposit - Deposit object
   * @returns {Promise<Object>}
   */
  async sendDepositApprovedEmail(user, deposit) {
    return this.sendEmail({
      to: user.email,
      subject: 'Deposit Request Approved',
      template: 'transactions/deposit-approved',
      context: {
        userName: user.business_name,
        amount: parseFloat(deposit.amount).toFixed(2),
        currency: deposit.currency || 'USD',
        depositId: deposit.id,
        approvedDate: new Date(deposit.approved_at).toLocaleString(),
        viewUrl: `${config.app.frontendUrl}/deposits/${deposit.id}`,
        supportEmail: config.email.from.email,
        year: new Date().getFullYear()
      }
    });
  }

  /**
   * Send payout completed email
   * @param {Object} user - User object
   * @param {Object} payout - Payout object
   * @returns {Promise<Object>}
   */
  async sendPayoutCompletedEmail(user, payout) {
    return this.sendEmail({
      to: user.email,
      subject: 'Payout Completed',
      template: 'transactions/payout-completed',
      context: {
        userName: user.business_name,
        amount: parseFloat(payout.amount).toFixed(2),
        currency: payout.currency || 'USD',
        payoutId: payout.id,
        completedDate: new Date(payout.completed_at).toLocaleString(),
        viewUrl: `${config.app.frontendUrl}/payouts/${payout.id}`,
        supportEmail: config.email.from.email,
        year: new Date().getFullYear()
      }
    });
  }

  /**
   * Send low balance alert email
   * @param {Object} user - User object
   * @param {number} currentBalance - Current balance
   * @param {number} threshold - Threshold amount
   * @returns {Promise<Object>}
   */
  async sendLowBalanceAlertEmail(user, currentBalance, threshold) {
    return this.sendEmail({
      to: user.email,
      subject: 'Low Balance Alert',
      template: 'alerts/low-balance',
      context: {
        userName: user.business_name,
        currentBalance: currentBalance.toFixed(2),
        threshold: threshold.toFixed(2),
        depositUrl: `${config.app.frontendUrl}/deposits/new`,
        supportEmail: config.email.from.email,
        year: new Date().getFullYear()
      }
    });
  }

  /**
   * Clear template cache
   */
  clearCache() {
    this.templatesCache.clear();
    logger.info('Email template cache cleared');
  }

  /**
   * Get service status
   * @returns {Object} Service status
   */
  getStatus() {
    return {
      enabled: config.email.enabled,
      transporterReady: !!this.transporter,
      cachedTemplates: this.templatesCache.size,
      config: {
        host: config.email.host,
        port: config.email.port,
        from: config.email.from.email
      }
    };
  }
}

// Export singleton instance
module.exports = new EmailService();