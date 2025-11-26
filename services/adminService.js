/**
 * User Service - Admin User Management
 * 
 * This service handles all admin user operations including:
 * - User registration and authentication
 * - JWT token generation and management
 * - CRUD operations for admin users
 * - Password hashing and verification
 */

const { PrismaClient } = require('@prisma/client');
const { withAccelerate } = require('@prisma/extension-accelerate'); 
const bcrypt = require('bcrypt'); // For password hashing
const jwt = require("jsonwebtoken"); // For JWT token generation

// Initialize Prisma client with Accelerate extension for optimized queries
const prisma = new PrismaClient().$extends(withAccelerate())


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
    
    // Validate input
    if (!email || !password) {
        throw new Error('Email and password are required');
    }
    
    try {
        // Find admin user by email address, only select necessary fields
        const user = await prisma.admin.findUnique({
            where: {email},
        });
        
        // Check if user exists
        if (!user) {
            console.error("Login failed: Invalid email");
            throw new Error('Invalid email');
        }

        // Compare provided password with stored hash
        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            console.error("Invalid password: ", password);
            throw new Error('Invalid password');
        }

        // Update lastLogin timestamp
        await prisma.admin.update({
            where: {id: user.id},
            data: {lastLogin: new Date()}
        });
        
        console.log(`Login successful for user: ${user.email}`);
        return {
            user,
            message: "Login successful",
        };

        /*
        // Generate JWT tokens for authenticated user
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        return { accessToken, refreshToken }; // Return both tokens
        */
    } catch (error) {
        console.error("Login error:", error.message); 
        throw new Error(error.message || 'Failed to login user');
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
        let user = await prisma.admin.findUnique({
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
    try {
        // Build update data only from provided fields
        let updatedData = {};
        if (requestBody.name !== undefined) updatedData.name = requestBody.name;
        if (requestBody.surname !== undefined) updatedData.surname = requestBody.surname;
        if (requestBody.email !== undefined) updatedData.email = requestBody.email;
        if (requestBody.number !== undefined) updatedData.number = requestBody.number;
        if (requestBody.password !== undefined) {
            updatedData.password = await bcrypt.hash(requestBody.password, 10);
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

/**
 * Delete all admin users from the system
 * 
 * Permanently removes all admin users from database except the last one.
 * This operation:
 * - Counts total admin users
 * - Prevents deletion if only one admin exists
 * - Uses a transaction for data consistency
 * - Returns count of deleted users
 * 
 * @returns {Object} Object containing count of deleted users
 * @throws {Error} If deletion fails or attempting to delete last admin
 */
const deleteAllUsers = async () => {
    try {
        // Start a transaction for data consistency
        return await prisma.$transaction(async (tx) => {
            // Count total admins
            const totalAdmins = await tx.admin.count();
            
            // Prevent deletion if only one admin exists
            if (totalAdmins <= 1) {
                throw new Error('Cannot delete the last admin user');
            }

            // Get all admin IDs except the most recently created one
            const admins = await tx.admin.findMany({
                orderBy: {
                    createdAt: 'desc'
                },
                skip: 1, // Skip the most recent admin
                select: {
                    id: true
                }
            });

            // Delete all admins except the most recent one
            const deleteResult = await tx.admin.deleteMany({
                where: {
                    id: {
                        in: admins.map(admin => admin.id)
                    }
                }
            });

            return {
                count: deleteResult.count
            };
        });
    } catch (error) {
        if (error.message === 'Cannot delete the last admin user') {
            throw error;
        }
        throw new Error('Failed to delete all users');
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
    deleteAllUsers, // Function to delete all users except the most recent
}
