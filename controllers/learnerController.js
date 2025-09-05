/**
 * Learner Controller - HTTP Request Handlers for Learner Management
 * 
 * This controller handles HTTP requests for both learners:
 * - User registration, authentication, and CRUD operations
 * - Learner registration and management
 */

const learnerService = require('../services/learnerService');

// Valid departments for learners
const validDepartments = ['marketing', 'it', 'learning', 'other'];


/**
 * Register one or more new learners (students).
 * 
 * Handles POST requests to create new learner accounts in bulk.
 * Expects a JSON object with a `learners` key containing an array of learner objects.
 * 
 * @param {Object} request - Express request object.
 * @param {Object} request.body - The request body, expected to have a `learners` array.
 * @param {Array<Object>} request.body.learners - Array of learner registration data.
 * @param {Object} response - Express response object.
 * @returns {void} Sends a JSON response with the count of created learners or an error.
 */
const registerLearner = async (request, response) => {
    try {
        const { learners } = request.body;

        // Basic validation
        if (!learners || !Array.isArray(learners) || learners.length === 0) {
            return response.status(400).json({ error: 'Request body must contain a non-empty array of learners.' });
        }

        // Validate department for each learner
        const validatedLearners = learners.map(learner => {
            if (learner.department && !validDepartments.includes(learner.department)) {
                return { ...learner, department: 'other' };
            }
            return learner;
        });

        // Call service layer to create new learners in bulk
        const result = await learnerService.createLearner(validatedLearners);
        
        // Return success response with the count of created learners
        response.status(201).json(result);
    } catch (error) {
        // Return error response if registration fails
        response.status(500).json({ error: error.message });
    }
};


/**
 * Get learner by ID
 * 
 * Handles GET requests to retrieve learner details:
 * - Fetches learner profile information
 * - Used for learner management and progress tracking
 * 
 * @param {Object} request - Express request object
 * @param {string} request.params.id - Learner ID from URL parameter
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with learner data or error
 */
const getLearner = async (request, response) => {
    // Extract learner ID from URL parameters
    const userId = request.params.id;
    
    try {
        // Call service layer to fetch learner data
        const learner = await learnerService.getLearner(userId);
        
        // Return learner data (should be 200, not 201)
        response.status(200).json(learner);
    } catch (error) {
        // Return error response if learner not found or fetch fails
        response.status(500).json({error: error.message});
    }
}


/**
 * Get all learners
 * 
 * Handles GET requests to retrieve all learners:
 * - Fetches complete list of learners
 * - Used for learner management dashboards
 * - Course enrollment and progress tracking
 * 
 * @param {Object} request - Express request object
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with array of learners or error
 */
const getAllLearners = async (request, response) => {
    try {
        // Call service layer to fetch all learners
        const learners = await learnerService.getAllLearners();
        
        // Return array of learners
        response.status(200).json(learners);
    } catch (error) {
        // Return error response if fetch fails
        response.status(500).json({error: error.message});
    }
}


/**
 * Update learner information
 * 
 * Handles PUT/PATCH requests to update learner data:
 * - Updates contact information (email, phone)
 * - Modifies WhatsApp number for messaging
 * - Updates profile details
 * 
 * @param {Object} request - Express request object
 * @param {string} request.params.id - Learner ID from URL parameter
 * @param {Object} request.body - Updated learner data
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with updated learner or error
 */
const updateLearner = async (request, response) => {
    // Extract learner ID and update data
    const userId = request.params.id;
    const requestBody = request.body;

    // If department is being updated, validate it
    if (requestBody.department && !validDepartments.includes(requestBody.department)) {
        requestBody.department = 'other';
    }
    
    try {
        // Call service layer to update learner
        const updatedLearner = await learnerService.updateLearner(userId, requestBody);
        
        // Return updated learner data
        response.status(200).json(updatedLearner);
    } catch (error) {
        // Return error response if update fails
        response.status(500).json({error: error.message});
    }
}



/**
 * Delete learner
 * 
 * Handles DELETE requests to remove learners:
 * - Permanently deletes learner account
 * - May fail if learner has related records (enrollments, progress)
 * - Use deleteAllLearners for cascading deletion
 * 
 * @param {Object} request - Express request object
 * @param {string} request.params.id - Learner ID from URL parameter
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with deleted learner or error
 */
const deleteLearner = async (request, response) => {
    // Extract learner ID from URL parameters
    const userId = request.params.id;
    
    try {
        // Call service layer to delete learner
        const deletedLearner = await learnerService.deleteLearner(userId);
        
        // Return deleted learner data for confirmation
        response.status(200).json(deletedLearner);
    } catch (error) {
        // Return error response if deletion fails
        response.status(500).json({error: error.message});
    }
}

/**
 * Delete all learners and related data
 * 
 * Handles DELETE requests to remove all learners:
 * - Cascading deletion of learners and related data
 * - Removes enrollments, progress, and learner records
 * - Uses database transaction for atomicity
 * - Destructive operation for system cleanup
 * 
 * @param {Object} request - Express request object
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with deletion results or error
 */
const deleteAllLearners = async (request, response) => {
    try {
        // Call service layer to delete all learners with cascading cleanup
        const deletedLearners = await learnerService.deleteAllLearners();
        
        // Return deletion results
        response.status(200).json(deletedLearners);
    } catch (error) {
        // Return error response if deletion fails
        response.status(500).json({error: error.message});
    }
}

// Export all controller functions for use in route handlers
module.exports = {
    registerLearner, // Handler for learner registration
    getLearner, // Handler for getting single learner
    getAllLearners, // Handler for getting all learners
    updateLearner, // Handler for updating learner
    deleteLearner, // Handler for deleting single learner
    deleteAllLearners, // Handler for deleting all learners
}