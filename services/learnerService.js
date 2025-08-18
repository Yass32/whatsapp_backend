/**
 * Learner Service - Student Management
 * 
 * This service handles all learner (student) operations including:
 * - Learner registration and profile management
 * - CRUD operations for learner accounts
 * - Cascading deletion of learner-related data
 * - Integration with course enrollment and progress tracking
 */

const { PrismaClient } = require('../generated/prisma');
const { withAccelerate } = require('@prisma/extension-accelerate'); 
const bcrypt = require('bcrypt'); // Imported but not used in current implementation

// Initialize Prisma client with Accelerate extension for optimized queries
const prisma = new PrismaClient().$extends(withAccelerate())


/**
 * Create a new learner account in the system
 * 
 * Registers a new student/learner who can enroll in courses and receive
 * WhatsApp-based learning content. Learners start as inactive and must
 * be activated through course enrollment.
 * 
 * @param {Object} learnerData - Learner registration data
 * @param {string} learnerData.name - Learner's first name
 * @param {string} learnerData.surname - Learner's last name
 * @param {string} learnerData.email - Learner's email address
 * @param {string} learnerData.number - Learner's WhatsApp phone number
 * @param {string} learnerData.department - Learner's department
 * @param {string} learnerData.company - Learner's company
 * @returns {Object} Created learner object
 * @throws {Error} If learner creation fails
 */
const createLearner = async (learnerData) => {
    // Destructure learner data from request
    const {name, surname, email, number, department, company} = learnerData;
    
    try {
        // Create new learner record in database
        const newLearner = await prisma.learner.create({
            data: {
                name,
                surname,
                email,
                number, // WhatsApp phone number for messaging
                department,
                company,
                // Note: active defaults to false, activated via course enrollment
            }
        });
        
        return newLearner; // Return created learner
    } catch (error) {
        console.error("Learner creation error:", error); 
        throw new Error('Failed to register learner'); // Generic error for security
    }
}


/**
 * Retrieve a single learner by ID
 * 
 * Fetches learner details from database by learner ID.
 * Used for profile viewing and learner management operations.
 * 
 * @param {string|number} userId - ID of the learner to retrieve
 * @returns {Object} Learner object with profile information
 * @throws {Error} If learner not found or database error occurs
 */
const getLearner = async (userId) => {
    try {
        // Find learner by ID (convert to number for safety)
        const learner = await prisma.learner.findUnique({
            where: { id: Number(userId) }
        });
        
        // Check if learner exists
        if (!learner) {
            throw new Error('learner not found');
        }
        
        return learner; // Return learner object
    } catch (error) {
        throw new Error('Failed to fetch learner'); // Generic error message
    }
}

/**
 * Retrieve all learners from the system
 * 
 * Fetches complete list of learners for management and reporting purposes.
 * Used in admin dashboards and learner management interfaces.
 * 
 * @returns {Array} Array of learner objects
 * @throws {Error} If database query fails
 */
const getAllLearners = async () => {
    try {
        // Fetch all learners from database
        const learners = await prisma.learner.findMany();
        return learners; // Return array of learners
    } catch (error) {
        throw new Error('Failed to get all learners'); // Generic error message
    }
}

/**
 * Update learner profile information
 * 
 * Updates learner contact information including email and phone number.
 * Phone number updates are important as they affect WhatsApp message delivery.
 * 
 * @param {string|number} userId - ID of learner to update
 * @param {Object} requestBody - Updated learner data
 * @param {string} requestBody.email - Updated email address
 * @param {string} requestBody.number - Updated WhatsApp phone number
 * @returns {Object} Updated learner object
 * @throws {Error} If learner not found or update fails
 */
const updateLearner = async (userId, requestBody) => {
    const { email, number} = requestBody;
    
    try {
        // Prepare update data (only email and number are updatable)
        let updatedData = { email, number };
        
        // Update learner in database
        const learner = await prisma.learner.update({
            where: { id: Number(userId) }, // Convert to number for safety
            data: updatedData
        });
        
        // Check if learner was found and updated
        if (!learner) {
            throw new Error('learner not found');
        }
        
        return learner; // Return updated learner
    } catch (error) {
        throw new Error('Failed to update learner information'); // Generic error
    }
}

/**
 * Delete a single learner from the system
 * 
 * Permanently removes learner from database. Note that this may fail if
 * the learner has related records (enrollments, progress) due to foreign
 * key constraints. Use deleteAllLearners for cascading deletion.
 * 
 * @param {string|number} userId - ID of learner to delete
 * @returns {Object} Deleted learner object
 * @throws {Error} If learner not found or deletion fails
 */
const deleteLearner = async (userId) => {
    try {
        // Delete learner from database
        const learner = await prisma.learner.delete({
            where: { id : Number(userId)} // Convert to number for safety
        });
        
        // Check if learner was found and deleted
        if (!learner) {
            throw new Error('learner not found');
        }
        
        return learner; // Return deleted learner object
    } catch (error) {
        throw new Error('Failed to delete learner'); // Generic error message
    }
} 

/**
 * Delete all learners and their related data from the system
 * 
 * Performs cascading deletion of all learner-related data in the correct order
 * to respect foreign key constraints:
 * 1. Course progress records (references learners and courses)
 * 2. Enrollment records (references learners and courses)
 * 3. Learner records (parent records)
 * 
 * Uses database transaction to ensure atomicity - either all data is deleted
 * or none is deleted if an error occurs.
 * 
 * @returns {Array} Array of deletion results for each table
 * @throws {Error} If deletion transaction fails
 */
const deleteAllLearners = async () => {
    try {
        // Use transaction to ensure all-or-nothing deletion
        return await prisma.$transaction([
            prisma.courseProgress.deleteMany({}), // Delete progress records first
            prisma.enrollment.deleteMany({}), // Delete enrollment records second
            prisma.learner.deleteMany({}), // Delete learner records last
        ]);
    } catch (error) {
        console.error("Failed to delete all learners and their related data:", error);
        throw error; // Re-throw for caller handling
    }
}; 


// Export all learner service functions for use in controllers
module.exports = {
    createLearner, // Function to register new learners
    getLearner, // Function to retrieve single learner by ID
    getAllLearners, // Function to retrieve all learners
    updateLearner, // Function to update learner profile information
    deleteLearner, // Function to delete single learner
    deleteAllLearners // Function to delete all learners with cascading cleanup
}
