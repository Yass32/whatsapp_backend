/**
 * Course Controller - HTTP Request Handlers for Course Management
 * 
 * This controller handles HTTP requests related to course operations:
 * - Course creation with lessons and scheduling
 * - Course deletion and cleanup
 * - Integration with courseService for business logic
 */

const courseService = require('../services/courseService');

/**
 * Create a new course with lessons and schedule delivery
 * 
 * Handles POST requests to create courses with:
 * - Course metadata (name, description, etc.)
 * - Nested lessons with content and quizzes
 * - Learner enrollment (phone numbers)
 * - Automated lesson delivery scheduling
 * 
 * @param {Object} request - Express request object
 * @param {Object} request.body - Request body containing course data
 * @param {Array} request.body.numbers - Array of learner phone numbers
 * @param {Object} request.body.courseData - Course information (name, description)
 * @param {Array} request.body.lessonsData - Array of lesson objects with content
 * @param {string} request.body.scheduleTime - Time for lesson delivery (HH:MM format)
 * @param {string} request.body.startDate - Course start date (ISO string)
 * @param {string} request.body.frequency - Delivery frequency (daily, weekly, etc.)
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with created course or error
 */
const createCourse = async (request, response) => {
    // Extract course creation parameters from request body
    const {numbers, courseData, lessonsData, scheduleTime, startDate, frequency} = request.body;
    
    try {
        // Call service layer to create course with all components
        const createdCourse = await courseService.createCourse(
            numbers, // Learner phone numbers for enrollment
            courseData, // Course metadata
            lessonsData, // Lesson content and structure
            scheduleTime, // Delivery time
            startDate, // Course start date
            frequency // Delivery frequency
        );
        
        // Return success response with created course data
        response.status(200).json(createdCourse);
    } catch (error) {
        // Return error response if course creation fails
        response.status(500).json({error: error.message});
    }
}

/**
 * Delete all courses and related data from the system
 * 
 * Handles DELETE requests to remove all courses and their associated data:
 * - Course records
 * - Lesson records
 * - Quiz records
 * - Enrollment records
 * - Progress tracking records
 * 
 * This is a destructive operation typically used for:
 * - System cleanup during development/testing
 * - Data reset operations
 * - Administrative maintenance
 * 
 * @param {Object} request - Express request object (no body required)
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with success message or error
 */
const deleteAllCourses = async (request, response) => {
    try {
        // Call service layer to perform cascading deletion
        await courseService.deleteAllCourses();
        
        // Return success response
        response.status(200).json({ 
            message: 'All courses and related data deleted successfully.' 
        });
    } catch (error) {
        // Return error response if deletion fails
        response.status(500).json({ error: error.message });
    }
};

// Export controller functions for use in route handlers
module.exports = {
    createCourse, // Handler for creating new courses with lessons and scheduling
    deleteAllCourses // Handler for deleting all courses and related data
}