/**
 * Group Routes - API Endpoints for Group Management
 * 
 * This module defines HTTP routes for group-related operations:
 * - Group CRUD operations
 * - Member management
 * - Course assignments
 */

const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { authenticateJWT, authorizeAdmin } = require('../middleware/auth');

// Apply authentication to all routes
//router.use(authenticateJWT, authorizeAdmin);

/**
 * POST /groups
 * Create a new group
 */
router.post('/', groupController.createGroup);

/**
 * GET /groups
 * Get all groups for current admin
 */
router.get('/:adminId', groupController.getAdminGroups);

/**
 * GET /groups/:groupId
 * Get detailed information about a specific group
 */
router.get('/:groupId', groupController.getGroupDetails);

/**
 * PUT /groups/:groupId
 * Update group information
 */
router.put('/:groupId', groupController.updateGroup);

/**
 * DELETE /groups/:groupId
 * Delete a group
 */
router.delete('/:groupId', groupController.deleteGroup);

/**
 * POST /groups/:groupId/members
 * Add members to a group
 */
router.post('/:groupId/members', groupController.addGroupMembers);

/**
 * DELETE /groups/:groupId/members
 * Remove members from a group
 */
router.delete('/:groupId/members', groupController.removeGroupMembers);

/**
 * POST /groups/:groupId/courses
 * Assign courses to a group
 */
router.post('/:groupId/courses', groupController.assignGroupCourses);

/**
 * DELETE /groups/:groupId/courses
 * Remove courses from a group
 */
router.delete('/:groupId/courses', groupController.removeGroupCourses);

module.exports = router;
