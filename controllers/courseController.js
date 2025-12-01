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
    const { courseData, lessonsData, learnerIds, scheduleTime, startDate, frequency} = request.body;

    // Validate required fields
    if (!courseData || !lessonsData || !learnerIds) {
        return response.status(400).json({
            error: 'Course data, lessons data, and learner IDs are required'
        });
    }

    if (!Array.isArray(lessonsData) || lessonsData.length === 0) {
        return response.status(400).json({
            error: 'Lessons data must be a non-empty array'
        });
    }

    if (!Array.isArray(learnerIds) || learnerIds.length === 0) {
        return response.status(400).json({
            error: 'Learner IDs must be a non-empty array'
        });
    }

    console.log(request.body)
    
    try {
        // Call service layer to create course with all components
        const createdCourse = await courseService.createCourse(
            courseData, // Course metadata
            lessonsData, // Lesson content and structure
            learnerIds, // Learner IDs for enrollment
            scheduleTime, // Delivery time
            startDate, // Course start date
            frequency // Delivery frequency
        );
        
        // Return success response with created course data
        response.status(201).json(createdCourse);
    } catch (error) {
        // Return appropriate error status
        const statusCode = 400;
        response.status(statusCode).json({error: error.message});
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

/**
 * Get all courses created by the currently logged-in admin
 * 
 * Handles GET requests to retrieve all courses, lessons, and quizzes
 * that were created by the authenticated admin user.
 * 
 * @param {Object} request - Express request object
 * @param {string} request.user.id - ID of the authenticated admin (from JWT)
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with courses data or error
 */
const getAdminCourses = async (request, response) => {
    try {
        // Get admin ID from the authenticated user (from JWT)
        //const adminId = request.user.id;
        const adminId = Number(request.params.adminId);
        
        if (!adminId) {
            return response.status(401).json({
                error: 'Unauthorized',
                message: 'Admin authentication required'
            });
        }

        // Call service layer to get courses for this admin
        const courses = await courseService.getAdminCourses(adminId);
        
        // Return success response with courses data
        response.status(200).json(courses);
    } catch (error) {
        // Log the error for debugging
        console.error('Error in getAdminCourses:', error);
        
        // Return error response
        response.status(500).json({
            error: 'Internal Server Error',
            message: error.message || 'Failed to retrieve admin courses'
        });
    }
};

/**
 * @desc    Get a single course by ID
 * @route   GET /api/courses/id/:courseId
 * @access  Public (or add authentication middleware if needed)
 */
const getCourseById = async (req, res) => {
    try {
        const { courseId } = req.params;

        if (!courseId) {
            return res.status(400).json({
                success: false,
                message: 'Course ID is required'
            });
        }

        const course = await courseService.getCourseById(courseId);

        res.status(200).json(course);
    } catch (error) {
        console.error('Error in getCourseById:', error);
        res.status(404).json({
            message: error.message || 'Failed to fetch course'
        });
    }
};

/**
 * Publish a course (change status from DRAFT to PUBLISHED)
 * @param {Object} request - Express request object
 * @param {Object} response - Express response object
 */
const publishCourse = async (request, response) => {
    try {
        const courseId = Number(request.params.courseId);

        if (!courseId) {
            return response.status(400).json({
                success: false,
                error: 'Course ID is required'
            });
        }

        const course = await courseService.publishCourse(courseId);
        
        response.status(200).json(course);
    } catch (error) {
        console.error('Error in publishCourse:', error);
        response.status(500).json({
            error: error.message || 'Failed to publish course'
        });
    }
};

/**
 * Archive a course (change status to ARCHIVED)
 * @param {Object} request - Express request object
 * @param {Object} response - Express response object
 */
const archiveCourse = async (request, response) => {
    try {
        const courseId = Number(request.params.courseId);

        if (!courseId) {
            return response.status(400).json({
                success: false,
                error: 'Course ID is required'
            });
        }

        const course = await courseService.archiveCourse(courseId);

        response.status(200).json(course);
    } catch (error) {
        console.error('Error in archiveCourse:', error);
        response.status(500).json({
            error: error.message || 'Failed to archive course'
        });
    }
};

/**
 * Unarchive a course by creating a new copy with specified status
 * @param {Object} request - Express request object
 * @param {Object} response - Express response object
 */
const unarchiveCourse = async (request, response) => {
    try {
        const originalCourseId = Number(request.params.courseId);

        if (!originalCourseId) {
            return response.status(400).json({
                success: false,
                error: 'Original course ID is required'
            });
        }

        // Get the new status from request body
        const { status: newStatus } = request.body;

        if (!newStatus || !['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(newStatus)) {
            return response.status(400).json({
                success: false,
                error: 'Valid status is required in request body (DRAFT, PUBLISHED, or ARCHIVED)'
            });
        }

        // Call service layer to unarchive the course
        const newCourse = await courseService.unarchiveCourse(originalCourseId, newStatus);

        response.status(201).json({
            success: true,
            message: 'Course unarchived successfully',
            data: newCourse
        });
    } catch (error) {
        console.error('Error in unarchiveCourse:', error);
        const statusCode = error.message.includes('not found') ? 404 : 500;
        response.status(statusCode).json({
            success: false,
            error: error.message || 'Failed to unarchive course'
        });
    }
};

/**
 * Update an existing draft course
 * @param {Object} request - Express request object
 * @param {Object} response - Express response object
 */
const updateCourse = async (request, response) => {
  try {
    const { courseId, courseData, lessonsData , numbers, scheduleTime, startDate, frequency} = request.body;

    if (!courseId) {
      return response.status(400).json({
        error: 'Course ID is required'
      });
    }

    // Validate required course data
    if (!courseData || (courseData && Object.keys(courseData).length === 0)) {
      return response.status(400).json({
        error: 'Course data is required'
      });
    }

    // Update the course
    const updatedCourse = await courseService.updateCourse(
      Number(courseId),
      courseData,
      lessonsData || [],
      numbers,
      scheduleTime,
      startDate,
      frequency
    );

    response.status(200).json(updatedCourse);
  } catch (error) {
    console.error('Error in updateCourse:', error);
    response.status(500).json({
      error: error.message || 'Failed to update course'
    });
  }
};


/**
 * Delete a course by ID
 * 
 * Handles DELETE requests to remove a specific course and all its related data.
 * Only the admin who created the course can delete it.
 * 
 * @param {Object} request - Express request object
 * @param {Object} request.params - Request parameters
 * @param {string} request.params.courseId - ID of the course to delete
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with success/error message
 */
const deleteCourse = async (request, response) => {
    try {
        const courseId = Number(request.params.courseId);

        if (!courseId) {
            return response.status(401).json({
                error: 'CourseId required'
            });
        }

        // Call service to delete the course
        await courseService.deleteCourse(courseId);
        
        response.status(200).json({
            message: 'Course deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting course:', error);
        const statusCode = error.message.includes('not found') ? 404 : 
                         error.message.includes('authorized') ? 403 : 500;
        response.status(statusCode).json({
            error: error.message || 'Failed to delete course'
        });
    }
};

// Export controller functions for use in route handlers
module.exports = {
    createCourse, // Handler for creating new courses with lessons and scheduling
    updateCourse, // Handler for updating existing draft courses
    deleteCourse, // Handler for deleting courses
    deleteAllCourses, // Handler for deleting all courses and related data
    getAdminCourses, // Handler for getting all courses for the logged-in admin
    publishCourse, // Handler for publishing a draft course
    archiveCourse, // Handler for archiving a course
    unarchiveCourse, // Handler for unarchiving a course by creating a new copy
    getCourseById // Handler for getting a single course by ID
};