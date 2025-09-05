/**
 * Learner Routes - API Endpoints for Learner Management
 * 
 * This module defines HTTP routes for learner-related operations:
 * - Learner registration and management
 * - CRUD operations for learners
 * - Bulk operations for learner management
 */

const express = require('express');
const router = express.Router();
const learnerController = require('../controllers/learnerController');
const { authenticateJWT, authorizeAdmin } = require('../middleware/auth');

/**
 * POST /learners
 * Register new learner(s)
 * 
 * Creates learner account with WhatsApp phone number for messaging.
 * Learners can enroll in courses and receive automated lessons.
 * 
 * Authentication: Currently disabled for development
 * TODO: Enable admin-only access in production
 */
//router.post('/', authenticateJWT, authorizeAdmin, adminController.registerLearner);
router.post('/', learnerController.registerLearner);


/**
 * GET /learners
 * Get all learners
 * 
 * Retrieves list of all learners for management and reporting.
 * Used for course enrollment and progress tracking.
*/
//router.get('/all', authenticateJWT, authorizeAdmin, adminController.getAllLearners);
router.get('/all', learnerController.getAllLearners);

/**
 * GET /learners/:id
 * Get single learner by ID
 * 
 * Retrieves specific learner details and profile information.
 * Used for learner management and progress monitoring.
 */
//router.get('/:id', authenticateJWT, authorizeAdmin, adminController.getLearner);
router.get('/:id', learnerController.getLearner);


/**
 * PUT /learners/:id
 * Update learner information
 * 
 * Updates learner contact details including WhatsApp phone number.
 * Phone number changes affect message delivery routing.
 */
//router.put('/:id', authenticateJWT, authorizeAdmin, adminController.updateLearner);
router.put('/:id', learnerController.updateLearner);


/**
 * DELETE /learners/:id
 * Delete single learner
 * 
 * Removes specific learner from system. 
*/
//router.delete('/:id', authenticateJWT, authorizeAdmin, adminController.deleteLearner);
router.delete('/:id', learnerController.deleteLearner);


/**
 * DELETE /learners
 * Delete all learners and related data
 * 
 * Performs cascading deletion of all learners and associated data.
 * Includes enrollments, progress records, and learner profiles.
 * Warning: Destructive operation for system cleanup.
*/
//router.delete('/all', authenticateJWT, authorizeAdmin, adminController.deleteAllLearners);
router.delete('/all', learnerController.deleteAllLearners);


module.exports = router;
