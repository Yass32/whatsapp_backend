/**
 * User Routes - API Endpoints for User and Learner Management
 * 
 * This module defines HTTP routes for user-related operations:
 * - Admin user registration, authentication, and CRUD operations
 * - Learner registration and management
 * - JWT token management (access and refresh tokens)
 * - Session handling (login/logout)
 * 
 * Note: Some authentication middleware is commented out for development.
 * In production, uncomment authentication for security.
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateJWT, authorizeAdmin } = require('../middleware/auth');

// === ADMIN USER ROUTES ===

/**
 * POST /users/register
 * Register a new admin user
 * 
 * Creates admin account with hashed password and profile information.
 * Used for system administrators who can manage courses and learners.
 */
router.post('/register', userController.registerUser);

/**
 * POST /users/login
 * Authenticate admin user
 * 
 * Validates credentials and returns JWT tokens.
 * Sets refresh token as HTTP-only cookie for security.
 */
router.post('/login', userController.loginUser);

/**
 * POST /users/refresh-token
 * Refresh access token
 * 
 * Uses refresh token from cookie to generate new access token.
 * Maintains user session without re-authentication.
 */
router.post('/refresh-token', userController.refreshToken);

/**
 * POST /users/logout
 * Log out admin user
 * 
 * Clears refresh token cookie to invalidate session.
 * Forces re-authentication for future requests.
 */
router.post('/logout', userController.logout);

/**
 * GET /users/getusers
 * Get all admin users
 * 
 * Retrieves list of all admin users for management purposes.
 * Used in admin dashboards and user oversight.
 */
router.get('/getusers', userController.getAllUsers);

/**
 * GET /users/:id
 * Get single admin user by ID
 * 
 * Retrieves specific admin user details for profile viewing.
 */
router.get('/:id', userController.getUser);

/**
 * PUT /users/:id
 * Update admin user information
 * 
 * Updates admin user profile, including optional password changes.
 * Passwords are automatically hashed before storage.
 */
router.put('/:id', userController.updateUser);

/**
 * DELETE /users/:id
 * Delete admin user
 * 
 * Permanently removes admin user from system.
 * Use with caution as operation cannot be undone.
 */
router.delete('/:id', userController.deleteUser);

// === LEARNER ROUTES ===

/**
 * POST /users/create-learner
 * Register a new learner (student)
 * 
 * Creates learner account with WhatsApp phone number for messaging.
 * Learners can enroll in courses and receive automated lessons.
 * 
 * Authentication: Currently disabled for development
 * TODO: Enable admin-only access in production
 */
// router.post('/create-learner', authenticateJWT, authorizeAdmin, userController.registerLearner);
router.post('/create-learner', userController.registerLearner);

/**
 * GET /users/get-all-learners
 * Get all learners
 * 
 * Retrieves list of all learners for management and reporting.
 * Used for course enrollment and progress tracking.
 */
router.get('/get-all-learners', userController.getAllLearners);

/**
 * GET /users/get-learner/:id
 * Get single learner by ID
 * 
 * Retrieves specific learner details and profile information.
 * Used for learner management and progress monitoring.
 */
router.get('/get-learner/:id', userController.getLearner);

/**
 * PUT /users/update-learner/:id
 * Update learner information
 * 
 * Updates learner contact details including WhatsApp phone number.
 * Phone number changes affect message delivery routing.
 */
router.put('/update-learner/:id', userController.updateLearner);

/**
 * DELETE /users/delete-learner/:id
 * Delete single learner
 * 
 * Removes specific learner from system.
 * May fail if learner has related records (enrollments, progress).
 */
router.delete('/delete-learner/:id', userController.deleteLearner);

/**
 * DELETE /users/delete-all-learners
 * Delete all learners and related data
 * 
 * Performs cascading deletion of all learners and associated data.
 * Includes enrollments, progress records, and learner profiles.
 * Warning: Destructive operation for system cleanup.
 */
router.delete('/delete-all-learners', userController.deleteAllLearners);

module.exports = router;

