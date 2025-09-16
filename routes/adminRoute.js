/**
 * Admin Routes - API Endpoints for Admin User Management
 * 
 * This module defines HTTP routes for admin-related operations:
 * - Admin user registration and authentication
 * - Admin CRUD operations
 * - JWT token management (access and refresh tokens)
 * - Session handling (login/logout)
*/

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateJWT, authorizeAdmin } = require('../middleware/auth');

/**
 * POST /register
 * Register a new admin user
 * 
 * Creates admin account with hashed password and profile information.
 * Used for system administrators who can manage courses and learners.
 */
router.post('/register', adminController.registerUser);

/**
 * POST /login
 * Authenticate admin user
 * 
 * Validates credentials and returns JWT tokens.
 * Sets refresh token as HTTP-only cookie for security.
 */
router.post('/login', adminController.loginUser);

/**
 * POST /refresh-token
 * Refresh access token
 * 
 * Uses refresh token from cookie to generate new access token.
 * Maintains user session without re-authentication.
 */
router.post('/refresh-token', adminController.refreshToken);

/**
 * POST /logout
 * Log out admin user
 * 
 * Clears refresh token cookie to invalidate session.
 * Forces re-authentication for future requests.
 */
router.post('/logout', adminController.logout);

/**
 * GET /all
 * Get all admin users
 * 
 * Retrieves list of all admin users for management purposes.
 * Used in admin dashboards and user oversight.
 */
//router.get('/all', authenticateJWT, authorizeAdmin, userController.getAllUsers);
router.get('/all', adminController.getAllUsers);


/**
 * GET /:id
 * Get single admin user by ID
 * 
 * Retrieves specific admin user details for profile viewing.
 */
//router.get('/admin/:id', authenticateJWT, authorizeAdmin, userController.getUser);
router.get('/:adminId', adminController.getUser);


/**
 * PUT /:id
 * Update admin user information
 * 
 * Updates admin user profile, including optional password changes.
 * Passwords are automatically hashed before storage.
 */
//router.put('/admin/:id', authenticateJWT, authorizeAdmin, userController.updateUser);
router.put('/:adminId', adminController.updateUser);


/**
 * DELETE /:id
 * Delete admin user
 * 
 * Permanently removes admin user from system.
 * Use with caution as operation cannot be undone.
 */
//router.delete('/admin/:id', authenticateJWT, authorizeAdmin, userController.deleteUser);
router.delete('/:adminId', adminController.deleteUser);


/**
 * DELETE /all
 * Delete all admins and related data
 * 
 * Performs cascading deletion of all admin users and associated data.
 * Includes user profiles and session records.
 * Will fail if attempting to delete the last admin user.
 */
//router.delete('/all', authenticateJWT, authorizeAdmin, userController.deleteAllUsers);
router.delete('/all', adminController.deleteAllUsers);


module.exports = router;
