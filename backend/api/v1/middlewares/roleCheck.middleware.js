/**
 * Role Check Middleware
 * 
 * Verifies user roles and permissions for route access.
 * 
 * Location: backend/api/v1/middlewares/roleCheck.middleware.js
 */

const { ForbiddenError, UnauthorizedError } = require('../../../src/shared/utils/ApiError');
const logger = require('../../../src/shared/utils/logger');

/**
 * Check if user has required role
 * @param {string|Array<string>} allowedRoles - Role(s) allowed to access
 * @returns {Function} Middleware function
 * 
 * @example
 * router.get('/admin/users', authenticate, checkRole('ADMIN'), controller.getUsers);
 * router.get('/content', authenticate, checkRole(['ADMIN', 'SELLER']), controller.getContent);
 */
function checkRole(allowedRoles) {
  // Convert single role to array
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user || !req.userRole) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check if user has required role
      if (!roles.includes(req.userRole)) {
        logger.security('Unauthorized role access attempt', {
          userId: req.userId,
          userRole: req.userRole,
          requiredRoles: roles,
          path: req.path,
          method: req.method,
          ip: req.ip
        });

        throw new ForbiddenError(
          `Access denied. Required role: ${roles.join(' or ')}`
        );
      }

      // User has required role
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Check if user is admin
 * Shorthand for checkRole('ADMIN')
 * 
 * @returns {Function} Middleware function
 */
function isAdmin() {
  return checkRole('ADMIN');
}

/**
 * Check if user is seller
 * Shorthand for checkRole('SELLER')
 * 
 * @returns {Function} Middleware function
 */
function isSeller() {
  return checkRole('SELLER');
}

/**
 * Check if user is admin or seller
 * 
 * @returns {Function} Middleware function
 */
function isAdminOrSeller() {
  return checkRole(['ADMIN', 'SELLER']);
}

/**
 * Check if user has any of the specified permissions
 * More granular than role checking
 * 
 * @param {Array<string>} permissions - Required permissions
 * @returns {Function} Middleware function
 * 
 * @example
 * router.post('/transactions', authenticate, hasPermission(['create_transaction']), controller.create);
 */
function hasPermission(permissions) {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      // Admin has all permissions
      if (req.userRole === 'ADMIN') {
        return next();
      }

      // Check user permissions
      const userPermissions = req.user.permissions || [];
      
      const hasRequiredPermission = permissions.some(permission => 
        userPermissions.includes(permission)
      );

      if (!hasRequiredPermission) {
        logger.security('Unauthorized permission access attempt', {
          userId: req.userId,
          requiredPermissions: permissions,
          userPermissions,
          path: req.path,
          ip: req.ip
        });

        throw new ForbiddenError(
          'You do not have the required permissions for this action'
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Check if user account is active
 * 
 * @returns {Function} Middleware function
 */
function isActiveAccount() {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      if (req.user.status !== 'ACTIVE') {
        logger.security('Inactive account access attempt', {
          userId: req.userId,
          status: req.user.status,
          path: req.path
        });

        const { AccountSuspendedError } = require('../../../src/shared/utils/ApiError');
        
        if (req.user.status === 'SUSPENDED') {
          throw new AccountSuspendedError('Your account has been suspended');
        }

        throw new ForbiddenError(
          `Account is ${req.user.status.toLowerCase()}. Please contact support.`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Check if user owns the resource
 * 
 * @param {string} paramName - Name of parameter containing user ID
 * @returns {Function} Middleware function
 * 
 * @example
 * router.get('/users/:userId/profile', authenticate, ownsResource('userId'), controller.getProfile);
 */
function ownsResource(paramName = 'userId') {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const resourceUserId = req.params[paramName];

      // Admin can access any resource
      if (req.userRole === 'ADMIN') {
        return next();
      }

      // Check ownership
      if (req.userId !== resourceUserId) {
        logger.security('Unauthorized resource access attempt', {
          userId: req.userId,
          attemptedResource: resourceUserId,
          path: req.path,
          ip: req.ip
        });

        throw new ForbiddenError(
          'You do not have permission to access this resource'
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Check if user owns resource or is admin
 * 
 * @param {string} paramName - Name of parameter containing user ID
 * @returns {Function} Middleware function
 */
function ownsResourceOrAdmin(paramName = 'userId') {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const resourceUserId = req.params[paramName];

      // Allow if admin or owner
      if (req.userRole === 'ADMIN' || req.userId === resourceUserId) {
        return next();
      }

      logger.security('Unauthorized resource access attempt', {
        userId: req.userId,
        attemptedResource: resourceUserId,
        path: req.path,
        ip: req.ip
      });

      throw new ForbiddenError(
        'You do not have permission to access this resource'
      );
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Block access based on role
 * Useful for denying specific roles
 * 
 * @param {string|Array<string>} blockedRoles - Role(s) to block
 * @returns {Function} Middleware function
 */
function blockRole(blockedRoles) {
  const roles = Array.isArray(blockedRoles) ? blockedRoles : [blockedRoles];

  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      if (roles.includes(req.userRole)) {
        logger.security('Blocked role access attempt', {
          userId: req.userId,
          userRole: req.userRole,
          blockedRoles: roles,
          path: req.path
        });

        throw new ForbiddenError(
          'This action is not available for your account type'
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  checkRole,
  isAdmin,
  isSeller,
  isAdminOrSeller,
  hasPermission,
  isActiveAccount,
  ownsResource,
  ownsResourceOrAdmin,
  blockRole
};