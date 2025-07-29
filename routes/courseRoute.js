const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');

// POST /courses - create a new course with lessons, quizzes, enrollments
router.post('/create-course', authenticateJWT, authorizeAdmin, courseController.createCourse);


// You can add more routes here, e.g.,
// GET /courses - list all courses
// GET /courses/:id - get a specific course
// etc.

module.exports = router;