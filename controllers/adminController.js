/**
 * User Controller - HTTP Request Handlers for User Management
 * 
 * This controller handles HTTP requests for both admin users and learners:
 * - User registration, authentication, and CRUD operations
 * - Learner registration and management
 * - JWT token management (access and refresh tokens)
 * - Cookie-based session handling
 */

const adminService = require('../services/adminService');


/**
 * Register one or more admin users
 * 
 * Handles POST requests to create new admin accounts with:
 * - Password hashing for security
 * - User profile information
 * - Company and department details
 * - Support for both single user and bulk registration
 * 
 * @param {Object} request - Express request object
 * @param {Object|Array} request.body - Single user object or array of user objects
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with created users or error details
 */
const registerUser = async (request, response) => {
    try {
        let userDataArray = request.body;
        
        // Support both single user and array of users
        if (!Array.isArray(userDataArray)) {
            userDataArray = [userDataArray];
        }
        
        // Validate that we have at least one user
        if (userDataArray.length === 0) {
            return response.status(400).json({
                error: 'No user data provided'
            });
        }
        
        const results = [];
        const errors = [];
        
        // Process each user
        for (let i = 0; i < userDataArray.length; i++) {
            const userData = userDataArray[i];
            
            try {
                // Validate required fields
                if (!userData.email || !userData.password || !userData.name) {
                    errors.push({
                        index: i,
                        error: 'Email, password, and name are required'
                    });
                    continue;
                }

                // Validate email format
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(userData.email)) {
                    errors.push({
                        index: i,
                        error: 'Invalid email format'
                    });
                    continue;
                }
                
                // Call service layer to create new admin user
                const newUser = await adminService.registerNewUser(userData);
                results.push({
                    index: i,
                    success: true,
                    user: newUser
                });
                
            } catch (error) {
                // Handle individual user errors
                const statusCode = error.message.includes('already exists') || error.message.includes('already in use') ? 409 : 500;
                errors.push({
                    index: i,
                    error: error.message,
                    statusCode: statusCode
                });
            }
        }
        
        // Return appropriate response based on results
        if (results.length === 0) {
            // All users failed
            return response.status(400).json({
                error: 'All user registrations failed',
                details: errors
            });
        } else if (errors.length > 0) {
            // Partial success
            return response.status(207).json({
                message: `Successfully registered ${results.length} out of ${userDataArray.length} users`,
                successful: results,
                failed: errors
            });
        } else {
            // All users succeeded
            return response.status(201).json({
                message: `Successfully registered ${results.length} users`,
                users: results.map(r => r.user)
            });
        }
        
    } catch (error) {
        // Handle unexpected server errors
        response.status(500).json({error: 'Internal server error'});
    }
}


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
        //const { accessToken, refreshToken } = await adminService.loginUser(request.body);
        
        // Set refresh token as HTTP-only cookie and return access token
        //response
        //    .cookie('refreshToken', refreshToken, cookieOptions) // Secure cookie for refresh token
        //    .status(200)
        //    .json({ accessToken }); // Access token in response body

        
        // If email or password is missing, return error
        if (!request.body.email || !request.body.password) {
            return response.status(400).json({ 
                error: 'Email and password are required' 
            });
        }

        // Call service layer to authenticate user
        const loginResult = await adminService.loginUser(request.body);
        
        // Return success response with logged in user data
        response.status(200).json(loginResult);


    } catch (error) {
        // Return appropriate error status
        const statusCode = error.message.includes('Invalid') || error.message.includes('not found') ? 401 : 500;
        response.status(statusCode).json({error: error.message});
    }
}

/**
 * Refresh access token using refresh token
 * 
 * Handles POST requests to obtain new access tokens without re-login:
 * - Validates refresh token from HTTP-only cookie
 * - Generates new access and refresh tokens (token rotation)
 * - Maintains user session without password re-entry
 * - Handles token expiration gracefully
 * 
 * @param {Object} request - Express request object
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with new tokens or error
 */
const refreshToken = async (request, response) => {
    // Extract refresh token from HTTP-only cookie
    const token = request.cookies.refreshToken;
    
    // Check if refresh token exists
    if (!token) {
        return response.status(401).json({ 
            status: 'error',
            code: 'TOKEN_MISSING',
            message: 'No refresh token provided',
            action: 'Please log in again to continue.'
        });
    }

    try {
        // Verify and validate refresh token
        const tokenData = await tokenService.verifyRefreshToken(token);
        
        // Get user data to generate new tokens
        const user = await adminService.getUser(tokenData.userId);
        
        // Generate new tokens (token rotation)
        const accessToken = tokenService.generateAccessToken(user);
        const newRefreshToken = tokenService.generateRefreshToken(user);
        
        // Blacklist the old refresh token
        await tokenService.blacklistToken(token);
        
        // Set new refresh token cookie and return new access token
        response
            .cookie('refreshToken', newRefreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            })
            .json({
                status: 'success',
                data: { accessToken }
            });
            
    } catch (error) {
        // Clear the refresh token cookie as it's no longer valid
        response.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });

        // Handle specific error cases
        if (error.message === 'Token has expired' || error.message === 'Invalid token') {
            return response.status(401).json({
                status: 'error',
                code: 'TOKEN_EXPIRED',
                message: 'Your session has expired',
                action: 'Please log in again to continue.'
            });
        }

        if (error.message === 'Token not found or blacklisted') {
            return response.status(401).json({
                status: 'error',
                code: 'TOKEN_INVALID',
                message: 'Invalid session',
                action: 'Please log in again to continue.'
            });
        }

        // Handle unexpected errors
        console.error('Refresh token error:', error);
        return response.status(500).json({
            status: 'error',
            code: 'SERVER_ERROR',
            message: 'An unexpected error occurred',
            action: 'Please try again or contact support if the problem persists.'
        });
    }
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
    const adminId = request.params.adminId;
    
    try {
        // Call service layer to fetch user data
        const admin = await adminService.getUser(adminId);
        
        // Return user data (should be 200, not 201)
        response.status(200).json(admin);
    } catch (error) {
        // Return error response if user not found or fetch fails
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
        const admins = await adminService.getAllUsers();
        
        // Return array of users
        response.status(200).json(admins);
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
    const adminId = Number(request.params.adminId);
    const requestBody = request.body;
    
    try {
        // Call service layer to update user
        const updatedUser = await adminService.updateUser(adminId, requestBody);
        
        // Return updated user data
        response.status(200).json(updatedUser);
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
    const adminId = request.params.adminId;
    
    try {
        // Call service layer to delete user
        const deletedUser = await adminService.deleteUser(adminId);
        
        // Return deleted user data for confirmation
        response.status(200).json(deletedUser);
    } catch (error) {
        // Return error response if deletion fails
        response.status(500).json({error: error.message});
    }
}

/**
 * Delete all admin users
 * 
 * Handles DELETE requests to remove all admin users:
 * - Permanently deletes all admin user accounts
 * - Removes all users from the system
 * - Use with extreme caution as this operation cannot be undone
 * - Will fail if attempting to delete the last admin user
 * 
 * @param {Object} request - Express request object
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with deletion results or error
 */
const deleteAllUsers = async (request, response) => {
    try {
        // Call service layer to delete all admin users
        const result = await adminService.deleteAllUsers();
        
        // Return deletion results
        response.status(200).json({
            message: 'All admin users deleted successfully',
            deletedCount: result.count
        });
    } catch (error) {
        // Return error response if deletion fails
        response.status(500).json({error: error.message});
    }
}

// Export all controller functions for use in route handlers
module.exports = {
    registerUser, // Handler for admin user registration
    loginUser, // Handler for user authentication
    refreshToken, // Handler for token refresh
    logout, // Handler for user logout
    getUser, // Handler for getting single admin user
    getAllUsers, // Handler for getting all admin users
    updateUser, // Handler for updating admin user
    deleteUser, // Handler for deleting admin user
    deleteAllUsers, // Handler for deleting all admin users
}