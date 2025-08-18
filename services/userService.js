/**
 * User Service - Admin User Management
 * 
 * This service handles all admin user operations including:
 * - User registration and authentication
 * - JWT token generation and management
 * - CRUD operations for admin users
 * - Password hashing and verification
 */

const { PrismaClient } = require('../generated/prisma');
const { withAccelerate } = require('@prisma/extension-accelerate'); 
const bcrypt = require('bcrypt'); // For password hashing
const jwt = require("jsonwebtoken"); // For JWT token generation

// Initialize Prisma client with Accelerate extension for optimized queries
const prisma = new PrismaClient().$extends(withAccelerate())

/**
 * Generate JWT access token for authenticated user
 * 
 * Access tokens are short-lived (60 minutes) and used for API authentication.
 * They contain user ID and role information for authorization.
 * 
 * @param {Object} user - User object containing id and role
 * @returns {string} Signed JWT access token
 */
function generateAccessToken(user) {
    return jwt.sign(
        { userId: user.id, role: user.role }, // Payload with user info
        process.env.JWT_SECRET, // Secret key from environment
        { expiresIn: '60m' } // Token expires in 60 minutes
    );
}

/**
 * Generate JWT refresh token for token renewal
 * 
 * Refresh tokens are long-lived (7 days) and used to obtain new access tokens
 * without requiring the user to log in again.
 * 
 * @param {Object} user - User object containing id and role
 * @returns {string} Signed JWT refresh token
 */
function generateRefreshToken(user) {
    return jwt.sign(
        { userId: user.id, role: user.role }, // Payload with user info
        process.env.JWT_REFRESH_SECRET, // Different secret for refresh tokens
        { expiresIn: '7d' } // Token expires in 7 days
    );
}

/**
 * Register a new admin user in the system
 * 
 * Creates a new admin account with hashed password and all required information.
 * Passwords are hashed using bcrypt with salt rounds of 10 for security.
 * 
 * @param {Object} userData - User registration data
 * @param {string} userData.name - User's first name
 * @param {string} userData.surname - User's last name
 * @param {string} userData.password - Plain text password (will be hashed)
 * @param {string} userData.email - User's email address (must be unique)
 * @param {string} userData.number - User's phone number
 * @param {string} userData.department - User's department
 * @param {string} userData.company - User's company
 * @returns {Object} Created admin user object (without password)
 * @throws {Error} If registration fails
 */
const registerNewUser = async (userData) => {
    // Destructure user data from request
    const {name, surname, password, email, number, department, company} = userData;
    
    try {
        // Hash the password with salt rounds of 10 for security
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create new admin user in database
        const newAdmin = await prisma.admin.create({
            data: {
                name,
                surname,
                password: hashedPassword, // Store hashed password
                email,
                number,
                department,
                company,
            }
        });
        
        return newAdmin; // Return created user
    } catch (error) {
        console.error("Registration error:", error); 
        throw new Error('Failed to register user'); // Re-throw with generic message
    }
}


/**
 * Authenticate admin user and generate JWT tokens
 * 
 * Validates user credentials and returns access and refresh tokens for
 * authenticated sessions. Uses bcrypt to compare hashed passwords.
 * 
 * @param {Object} userData - Login credentials
 * @param {string} userData.email - User's email address
 * @param {string} userData.password - Plain text password
 * @returns {Object} Object containing accessToken and refreshToken
 * @throws {Error} If login fails (user not found or invalid password)
 */
const loginUser = async (userData) => {
    const {email, password} = userData;
    
    try {
        // Find admin user by email address
        const user = await prisma.admin.findUnique({
            where: {email}
        });
        
        // Check if user exists
        if (!user) {
            throw new Error('Admin not found');
        }

        // Compare provided password with stored hash
        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            throw new Error('Invalid password');
        }

        // Generate JWT tokens for authenticated user
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        return { accessToken, refreshToken }; // Return both tokens
    } catch (error) {
        throw new Error('Failed to login user'); // Generic error for security
    }
}

/**
 * Retrieve a single admin user by ID
 * 
 * Fetches admin user details from database by user ID.
 * Used for profile viewing and user management operations.
 * 
 * @param {string|number} userId - ID of the user to retrieve
 * @returns {Object} Admin user object
 * @throws {Error} If user not found or database error occurs
 */
const getUser = async (userId) => {
    try {
        // Find admin user by ID (convert to number for safety)
        const user = await prisma.admin.findUnique({
            where: { id: Number(userId) }
        });
        
        // Check if user exists
        if (!user) {
            throw new Error('User not found');
        }
        
        return user; // Return user object
    } catch (error) {
        throw new Error('Failed to fetch user'); // Generic error message
    }
}

/**
 * Retrieve all admin users from the system
 * 
 * Fetches complete list of admin users for management purposes.
 * Used in admin dashboards and user management interfaces.
 * 
 * @returns {Array} Array of admin user objects
 * @throws {Error} If database query fails
 */
const getAllUsers = async () => {
    try {
        // Fetch all admin users from database
        const users = await prisma.admin.findMany();
        return users; // Return array of users
    } catch (error) {
        throw new Error('Failed to get all users'); // Generic error message
    }
}

/**
 * Update admin user information
 * 
 * Updates user profile information including optional password change.
 * If password is provided, it will be hashed before storage.
 * 
 * @param {string|number} userId - ID of user to update
 * @param {Object} requestBody - Updated user data
 * @param {string} requestBody.name - Updated first name
 * @param {string} requestBody.surname - Updated last name
 * @param {string} requestBody.email - Updated email address
 * @param {string} [requestBody.password] - New password (optional)
 * @param {string} requestBody.number - Updated phone number
 * @returns {Object} Updated admin user object
 * @throws {Error} If user not found or update fails
 */
const updateUser = async (userId, requestBody) => {
    const {name, surname, email, password, number} = requestBody;
    
    try {
        // Prepare base update data
        let updatedData = { name, surname, email, number };
        
        // Hash new password if provided
        if (password) {
            updatedData.password = await bcrypt.hash(password, 10);
        }
        
        // Update user in database
        const user = await prisma.admin.update({
            where: { id: Number(userId) }, // Convert to number for safety
            data: updatedData
        });
        
        // Check if user was found and updated
        if (!user) {
            throw new Error('User not found');
        }
        
        return user; // Return updated user
    } catch (error) {
        throw new Error('Failed to update user information'); // Generic error
    }
}

/**
 * Delete admin user from the system
 * 
 * Permanently removes admin user from database.
 * Use with caution as this operation cannot be undone.
 * 
 * @param {string|number} userId - ID of user to delete
 * @returns {Object} Deleted user object
 * @throws {Error} If user not found or deletion fails
 */
const deleteUser = async (userId) => {
    try {
        // Delete user from database
        const user = await prisma.admin.delete({
            where: { id : Number(userId)} // Convert to number for safety
        });
        
        // Check if user was found and deleted
        if (!user) {
            throw new Error('User not found');
        }
        
        return user; // Return deleted user object
    } catch (error) {
        throw new Error('Failed to delete user'); // Generic error message
    }
}


// Export all user service functions for use in controllers
module.exports = {
    registerNewUser, // Function to register new admin users
    loginUser, // Function to authenticate users and generate tokens
    getUser, // Function to retrieve single user by ID
    getAllUsers, // Function to retrieve all admin users
    updateUser, // Function to update user information
    deleteUser, // Function to delete user from system
    generateAccessToken, // Function to generate short-lived access tokens
    generateRefreshToken, // Function to generate long-lived refresh tokens
}
