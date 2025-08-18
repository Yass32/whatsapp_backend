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
 * POST /courses/create-course
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
// router.post('/create-course', authenticateJWT, authorizeAdmin, courseController.createCourse);
router.post('/create-course', courseController.createCourse);

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

// Future route implementations:
// GET /courses - List all courses with pagination
// GET /courses/:id - Get specific course details
// PUT /courses/:id - Update course information
// DELETE /courses/:id - Delete specific course
// GET /courses/:id/progress - Get course progress for all learners
// POST /courses/:id/enroll - Enroll learners in specific course

module.exports = router;