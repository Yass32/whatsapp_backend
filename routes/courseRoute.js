/**
 * Course Routes - API Endpoints for Course Management
 * 
 * This module defines HTTP routes for course-related operations:
 * - Course creation with lessons and scheduling
 * - Course deletion and cleanup
 * - Integration with course controller handlers
 * 
 * Note: Authentication middleware is currently commented out for development.
 * In production, uncomment authentication for security.
 */

const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const { authenticateJWT, authorizeAdmin } = require('../middleware/auth');

/**
 * POST /courses/
 * Create a new course with lessons, quizzes, and enrollments
 * 
 * Creates a complete course structure including:
 * - Course metadata (name, description)
 * - Nested lessons with content
 * - Quiz questions and answers
 * - Learner enrollments
 * - Automated lesson delivery scheduling
 * 
 * Authentication: Currently disabled for development
 * TODO: Enable authentication in production
 */
// router.post('/', authenticateJWT, authorizeAdmin, courseController.createCourse);
router.post('/', courseController.createCourse);

/**
 * DELETE /courses/:id
 * Delete a specific course by ID
 * 
 * Permanently deletes a course and all its related data including:
 * - Course metadata
 * - All lessons and their content
 * - Associated quizzes and questions
 * - Enrollment records
 * - Progress tracking data
 * 
 * Authentication: Required (Admin)
 * Permissions: Only the admin who created the course can delete it
 */
//router.delete('/:id', authenticateJWT, authorizeAdmin, courseController.deleteCourse);
router.delete('/:courseId', courseController.deleteCourse);


/**
 * DELETE /courses/all
 * Delete all courses and related data
 * 
 * Performs cascading deletion of:
 * - All course records
 * - Associated lessons and quizzes
 * - Enrollment records
 * - Progress tracking data
 * 
 * Warning: This is a destructive operation used for system cleanup
 */
router.delete('/all', courseController.deleteAllCourses);

/**
 * GET /courses/:adminId
 * Get all courses for the logged-in admin
 * 
 * Retrieves all courses, lessons, and quizzes created by the authenticated admin.
 * Requires valid admin authentication token in the Authorization header.
 * 
 * Response includes:
 * - success: Boolean indicating success/failure
 * - count: Number of courses found
 * - data: Array of course objects with nested lessons and quizzes
 * 
 * Authentication: Required (Admin)
 */
//router.get('/admin', authenticateJWT, authorizeAdmin, courseController.getAdminCourses);
// Get courses for a specific admin with optional status filter
router.get('/:adminId', courseController.getAdminCourses);

/**
 * Publish a draft course
 * PUT /courses/:courseId/publish
 * 
 * Changes the status of a course from DRAFT to PUBLISHED
 * Only the course owner (admin) can publish a course
 * 
 * Authentication: Required (Admin)
 */
//router.put('/:courseId/publish', authenticateJWT, authorizeAdmin, courseController.publishCourse);
router.put('/:courseId/publish', courseController.publishCourse);

/**
 * Archive a course
 * PUT /courses/:courseId/archive
 *
 * Changes the status of a course to ARCHIVED
 * Only the course owner (admin) can archive a course
 *
 * Authentication: Required (Admin)
 */
//router.put('/:courseId/archive', authenticateJWT, authorizeAdmin, courseController.archiveCourse);
router.put('/:courseId/archive', courseController.archiveCourse);

/**
 * Unarchive a course by creating a new copy
 * POST /courses/unarchive/:courseId
 *
 * Creates a new course by copying all data from an archived course.
 * The original course remains unchanged, and a new course is created
 * with the specified status from the request body.
 *
 * Request body should contain:
 * - status: The status for the new course (DRAFT, PUBLISHED, or ARCHIVED)
 *
 * Authentication: Required (Admin)
 */
router.post('/:courseId/unarchive', courseController.unarchiveCourse);

/**
 * Get courses by status
 * GET /courses/status/:status
 * 
 * Retrieves courses filtered by status (DRAFT, PUBLISHED, ARCHIVED)
 * Returns only courses owned by the authenticated admin
 * 
 * Authentication: Required (Admin)
 */
router.get('/status/:status', authenticateJWT, authorizeAdmin, (req, res) => {
    const { status } = req.params;
    const adminId = req.user.id;
    
    // Validate status
    const validStatuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid status. Must be one of: DRAFT, PUBLISHED, ARCHIVED'
        });
    }
    
    return courseController.getAdminCourses({ ...req, params: { adminId } }, res, status);
});

/**
 * Update a draft course
 * PUT /courses/:courseId
 * 
 * Updates an existing draft course with new data including lessons and quizzes.
 * Only the course owner (admin) can update the course.
 * 
 * Request body should contain:
 * - course: { name, description, coverImage? }
 * - lessons: Array of lesson objects with quizzes
 * 
 * Authentication: Required (Admin)
 */
//router.put('/:courseId', authenticateJWT, authorizeAdmin, courseController.updateCourse);
router.put('/:courseId', courseController.updateCourse);

/**
 * @route   GET /api/courses/id/:courseId
 * @desc    Get a single course by ID with its lessons and quizzes
 * @access  Public (or add authentication middleware if needed)
 */
router.get('/id/:courseId', courseController.getCourseById);
//router.get('/id/:courseId', authenticateJWT, authorizeAdmin, courseController.getCourseById);

// Future route implementations:
// GET /courses - List all published courses with pagination (public)
// GET /courses/:id - Get course details with lessons and quizzes
// PUT /courses/:id - Update course information
// DELETE /courses/:id - Delete a specific course
// GET /courses/:id/progress - Get course progress for all learners
// POST /courses/:id/enroll - Enroll learners in specific course

module.exports = router;