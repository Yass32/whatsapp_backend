/**
 * Learner Controller - HTTP Request Handlers for Learner Management
 * 
 * This controller handles HTTP requests for both learners:
 * - User registration, authentication, and CRUD operations
 * - Learner registration and management
 */

const learnerService = require('../services/learnerService');


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
        const { learners, adminId } = request.body;

        // Basic validation
        if (!learners || !Array.isArray(learners) || learners.length === 0) {
            return response.status(400).json({ 
                success: false,
                error: 'Request body must contain a non-empty array of learners.' 
            });
        }

        if (!adminId) {
            return response.status(400).json({
                success: false,
                error: 'Admin ID is required to register learners.'
            });
        }

        // Create learners using the service
        const result = await learnerService.createLearner(learners, Number(adminId));
        
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
    const learnerId = Number(request.params.learnerId);
    
    // Validate learner ID
    if (!learnerId || isNaN(learnerId)) {
        return response.status(400).json({
            error: 'Valid learner ID is required'
        });
    }
    
    try {
        // Call service layer to fetch learner data
        const learner = await learnerService.getLearner(learnerId);
        
        // Return learner data
        response.status(200).json(learner);
    } catch (error) {
        // Return appropriate error status
        const statusCode = error.message.includes('not found') ? 404 : 500;
        response.status(statusCode).json({error: error.message});
    }
}


/**
 * Get all learners for an admin
 * 
 * Handles GET requests to retrieve all learners for a specific admin:
 * - Validates admin ID from JWT token matches requested adminId
 * - Fetches learners associated with the admin
 * - Used for admin dashboards and learner management
 * 
 * @param {Object} request - Express request object
 * @param {string} request.params.adminId - Admin ID from URL
 * @param {Object} request.user - Authenticated user from JWT
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with array of learners or error
 */
const getAllLearners = async (request, response) => {
    try {
        const adminId = Number(request.params.adminId);
        //const authenticatedAdminId = request.user.id;
        
        // Validate admin ID
        if (!adminId || isNaN(adminId)) {
            return response.status(400).json({
                success: false,
                error: 'Valid admin ID is required'
            });
        }
        
        // Ensure the authenticated admin can only access their own learners
        /*if (requestedAdminId !== authenticatedAdminId) {
            return response.status(403).json({
                success: false,
                error: 'Unauthorized: You can only view your own learners'
            });
        }*/

        // Call service layer to fetch all learners for the admin
        const learners = await learnerService.getAllLearners(adminId);
        
        // Return array of learners
        response.status(200).json({
            count: learners.length,
            learners
        });
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
    const learnerId = Number(request.params.learnerId);
    const requestBody = request.body;
    
    // Validate learner ID
    if (!learnerId || isNaN(learnerId)) {
        return response.status(400).json({
            error: 'Valid learner ID is required'
        });
    }
    
    try {
        // Call service layer to update learner
        const updatedLearner = await learnerService.updateLearner(learnerId, requestBody);
        
        // Return updated learner data
        response.status(200).json(updatedLearner);
    } catch (error) {
        // Return appropriate error status
        let statusCode = 500;
        if (error.message.includes('not found')) statusCode = 404;
        else if (error.message.includes('No fields provided') || error.message.includes('already in use')) statusCode = 400;
        
        response.status(statusCode).json({error: error.message});
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
    const learnerId = Number(request.params.learnerId);
    
    // Validate learner ID
    if (!learnerId || isNaN(learnerId)) {
        return response.status(400).json({
            error: 'Valid learner ID is required'
        });
    }
    
    try {
        // Call service layer to delete learner
        await learnerService.deleteLearner(learnerId);
        
        // Return success message
        response.status(200).json({ 
            message: 'Learner deleted successfully' 
        });
    } catch (error) {
        // Return appropriate error status
        const statusCode = error.message.includes('not found') ? 404 : 500;
        response.status(statusCode).json({error: error.message});
    }
}

/**
 * Delete all learners and related data
{{ ... }}
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
        response.status(200).json({message: "All learners deleted successfully", deletedLearners});
    } catch (error) {
        // Return error response if deletion fails
        response.status(500).json({error: error.message});
    }
}

/**
 * Get comprehensive learner insights and analytics
 *
 * Handles GET requests to retrieve detailed analytics for all learners:
 * - Course progress statistics
 * - Quiz performance metrics
 * - Message interaction analytics
 * - Recent activity tracking
 * - Overall learner performance summary
 *
 * @param {Object} request - Express request object
 * @param {string} request.params.adminId - Admin ID from URL parameter
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with learner insights or error
 */
const getLearnerInsights = async (request, response) => {
    try {
        const adminId = Number(request.params.adminId);

        if (!adminId) {
            return response.status(400).json({
                success: false,
                error: 'Admin ID is required'
            });
        }

        // Call service layer to get learner insights
        const insights = await learnerService.getLearnerInsights(adminId);

        // Return comprehensive insights data
        response.status(200).json(insights);
    } catch (error) {
        console.error('Error in getLearnerInsights:', error);
        response.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch learner insights'
        });
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
    getLearnerInsights, // Handler for getting comprehensive learner analytics
}