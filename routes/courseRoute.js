const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const { authenticateJWT, authorizeAdmin } = require('../middleware/auth');

// POST /courses - create a new course with lessons, quizzes, enrollments
//router.post('/create-course', authenticateJWT, authorizeAdmin, courseController.createCourse);

router.post('/create-course', courseController.createCourse);
router.delete('/all', courseController.deleteAllCourses);


// You can add more routes here, e.g.,
// GET /courses - list all courses
// GET /courses/:id - get a specific course
// etc.

module.exports = router;