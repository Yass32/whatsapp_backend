/**
 * User Controller - HTTP Request Handlers for User and Learner Management
 * 
 * This controller handles HTTP requests for both admin users and learners:
 * - User registration, authentication, and CRUD operations
 * - Learner registration and management
 * - JWT token management (access and refresh tokens)
 * - Cookie-based session handling
 */

const userService = require('../services/userService');
const learnerService = require('../services/learnerService');

// Valid departments for users
const validDepartments = ['marketing', 'it', 'learning', 'other'];

/**
 * Register a new admin user
 * 
 * Handles POST requests to create new admin accounts with:
 * - Password hashing for security
 * - User profile information
 * - Company and department details
 * 
 * @param {Object} request - Express request object
 * @param {Object} request.body - User registration data
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with created user or error
 */
const registerUser = async (request, response) => {
    try {
        const userData = request.body;
        
        // If department is provided and not valid, set to 'other'
        if (userData.department && !validDepartments.includes(userData.department)) {
            userData.department = 'other';
        }

        // Call service layer to create new admin user
        const newUser = await userService.registerNewUser(userData);
        
        // Return success response with created user data
        response.status(201).json(newUser);
    } catch (error) {
        // Return error response if registration fails
        response.status(500).json({error: error.message});
    }
}

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
 * Cookie configuration for refresh tokens
 * 
 * Security settings for refresh token cookies:
 * - httpOnly: Prevents XSS attacks by making cookie inaccessible to JavaScript
 * - secure: HTTPS-only in production for security
 * - sameSite: Prevents CSRF attacks
 * - maxAge: 7-day expiration matching token lifetime
 */
const cookieOptions = {
    httpOnly: true, // Prevent XSS attacks
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'strict', // Prevent CSRF attacks
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
};

/**
 * Authenticate admin user and issue tokens
 * 
 * Handles POST requests for user login with:
 * - Credential validation (email and password)
 * - JWT access token generation (short-lived)
 * - JWT refresh token generation (long-lived, stored in HTTP-only cookie)
 * 
 * @param {Object} request - Express request object
 * @param {Object} request.body - Login credentials (email, password)
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with access token and sets refresh token cookie
 */
const loginUser = async (request, response) => {
    try {
        // Authenticate user and generate tokens
        const { accessToken, refreshToken } = await userService.loginUser(request.body);
        
        // Set refresh token as HTTP-only cookie and return access token
        response
            .cookie('refreshToken', refreshToken, cookieOptions) // Secure cookie for refresh token
            .status(200)
            .json({ accessToken }); // Access token in response body
    } catch (error) {
        // Return error response if login fails
        response.status(500).json({error: error.message});
    }
}

/**
 * Refresh access token using refresh token
 * 
 * Handles POST requests to obtain new access tokens without re-login:
 * - Validates refresh token from HTTP-only cookie
 * - Generates new access token if refresh token is valid
 * - Maintains user session without password re-entry
 * 
 * @param {Object} request - Express request object
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with new access token or error
 */
const refreshToken = (request, response) => {
    // Extract refresh token from HTTP-only cookie
    const token = request.cookies.refreshToken;
    
    // Check if refresh token exists
    if (!token) {
        return response.status(401).json({ message: 'No refresh token provided' });
    }

    // Verify refresh token and generate new access token
    const jwt = require('jsonwebtoken');
    jwt.verify(token, process.env.JWT_REFRESH_SECRET, (err, user) => {
        if (err) {
            return response.status(403).json({ message: 'Invalid or expired refresh token' });
        }
        
        // Generate new access token using user data from refresh token
        const accessToken = userService.generateAccessToken(user);
        response.json({ accessToken });
    });
};

/**
 * Log out user by clearing refresh token cookie
 * 
 * Handles POST requests to log out users by:
 * - Clearing the refresh token cookie
 * - Invalidating the user session
 * - Forcing re-authentication for future requests
 * 
 * @param {Object} request - Express request object
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response confirming logout
 */
const logout = (request, response) => {
    // Clear refresh token cookie with same options used to set it
    response.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
    });
    
    // Return success response
    response.status(200).json({ message: 'Logged out successfully' });
};

/**
 * Get admin user by ID
 * 
 * Handles GET requests to retrieve admin user details:
 * - Fetches user profile information
 * - Used for user management and profile viewing
 * 
 * @param {Object} request - Express request object
 * @param {string} request.params.id - User ID from URL parameter
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with user data or error
 */
const getUser = async (request, response) => {
    // Extract user ID from URL parameters
    const userId = request.params.id;
    
    try {
        // Call service layer to fetch user data
        const user = await userService.getUser(userId);
        
        // Return user data (should be 200, not 201)
        response.status(200).json(user);
    } catch (error) {
        // Return error response if user not found or fetch fails
        response.status(500).json({error: error.message});
    }
}

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
 * Get all admin users
 * 
 * Handles GET requests to retrieve all admin users:
 * - Fetches complete list of admin users
 * - Used for user management dashboards
 * - Administrative oversight and reporting
 * 
 * @param {Object} request - Express request object
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with array of users or error
 */
const getAllUsers = async (request, response) => {
    try {
        // Call service layer to fetch all admin users
        const users = await userService.getAllUsers();
        
        // Return array of users
        response.status(200).json(users);
    } catch (error) {
        // Return error response if fetch fails
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
 * Update admin user information
 * 
 * Handles PUT/PATCH requests to update admin user data:
 * - Updates profile information
 * - Handles password changes (with hashing)
 * - Modifies contact details
 * 
 * @param {Object} request - Express request object
 * @param {string} request.params.id - User ID from URL parameter
 * @param {Object} request.body - Updated user data
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with updated user or error
 */
const updateUser = async (request, response) => {
    // Extract user ID and update data
    const userId = request.params.id;
    const requestBody = request.body;

    // If department is being updated, validate it
    if (requestBody.department && !validDepartments.includes(requestBody.department)) {
        requestBody.department = 'other';
    }
    
    try {
        // Call service layer to update user
        const updatedUser = await userService.updateUser(userId, requestBody);
        
        // Return updated user data
        response.status(200).json(updatedUser);
    } catch (error) {
        // Return error response if update fails
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
 * Delete admin user
 * 
 * Handles DELETE requests to remove admin users:
 * - Permanently deletes user account
 * - Removes user from system
 * - Use with caution as operation cannot be undone
 * 
 * @param {Object} request - Express request object
 * @param {string} request.params.id - User ID from URL parameter
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with deleted user or error
 */
const deleteUser = async (request, response) => {
    // Extract user ID from URL parameters
    const userId = request.params.id;
    
    try {
        // Call service layer to delete user
        const deletedUser = await userService.deleteUser(userId);
        
        // Return deleted user data for confirmation
        response.status(200).json(deletedUser);
    } catch (error) {
        // Return error response if deletion fails
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
    registerUser, // Handler for admin user registration
    registerLearner, // Handler for learner registration
    loginUser, // Handler for user authentication
    refreshToken, // Handler for token refresh
    logout, // Handler for user logout
    getUser, // Handler for getting single admin user
    getLearner, // Handler for getting single learner
    getAllUsers, // Handler for getting all admin users
    getAllLearners, // Handler for getting all learners
    updateUser, // Handler for updating admin user
    updateLearner, // Handler for updating learner
    deleteUser, // Handler for deleting admin user
    deleteLearner, // Handler for deleting single learner
    deleteAllLearners, // Handler for deleting all learners
}