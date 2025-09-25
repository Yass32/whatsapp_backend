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
 * Request body should contain:
 * - learners: Array of learner objects
 * - adminId: ID of the admin creating the learners
 * 
 * Authentication: Required (Admin)
 */
//router.post('/', authenticateJWT, authorizeAdmin, learnerController.registerLearner);
router.post('/', learnerController.registerLearner);


/**
 * GET /learners/:adminId
 * Get all learners for an admin
 * 
 * Retrieves list of all learners managed by a specific admin.
 * Used for course enrollment and progress tracking.
 * 
 * @param {string} adminId - The ID of the admin whose learners to fetch
 * 
 * Authentication: Required (Admin)
 * Permissions: Only the admin can view their own learners
 */
//router.get('/:adminId', authenticateJWT, authorizeAdmin, learnerController.getAllLearners);
router.get('/:adminId', learnerController.getAllLearners);

/**
 * GET /learners/:id
 * Get single learner by ID
 * 
 * Retrieves specific learner details and profile information.
 * Used for learner management and progress monitoring.
 */
//router.get('/:id', authenticateJWT, authorizeAdmin, adminController.getLearner);
router.get('/:learnerId/details', learnerController.getLearner);


/**
 * PUT /learners/:id
 * Update learner information
 * 
 * Updates learner contact details including WhatsApp phone number.
 * Phone number changes affect message delivery routing.
 */
//router.put('/:id', authenticateJWT, authorizeAdmin, adminController.updateLearner);
router.put('/:learnerId', learnerController.updateLearner);


/**
 * DELETE /learners/:id
 * Delete single learner
 * 
 * Removes specific learner from system. 
*/
//router.delete('/:id', authenticateJWT, authorizeAdmin, adminController.deleteLearner);
router.delete('/:learnerId', learnerController.deleteLearner);


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

/**
 * GET /learners/:adminId/insights
 * Get comprehensive learner insights and analytics
 *
 * Retrieves detailed analytics for all learners including:
 * - Course progress statistics
 * - Quiz performance metrics
 * - Message interaction analytics
 * - Recent activity tracking
 * - Overall learner performance summary
 *
 * Authentication: Required (Admin)
 */
router.get('/:adminId/insights', learnerController.getLearnerInsights);


module.exports = router;
