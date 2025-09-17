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
const { welcomeQueue, addJobToQueue } = require('./queueService');
const groupService = require('./groupService');
// Initialize Prisma client with Accelerate extension for optimized queries
const prisma = new PrismaClient().$extends(withAccelerate())


/**
 * Create one or more new learner accounts in the system.
 * 
 * Registers new students/learners who can enroll in courses. This function
 * 
 * @param {Array} learnersData - Array of learner objects to create
 * @param {number} adminId - ID of the admin creating the learners
 * @returns {Object} Object with count of created learners and success/error info
 * @throws {Error} If creation fails or adminId is invalid
 */
const createLearner = async (learnersData, adminId, groupId) => {
    try {
        // Validate input
        if (!Array.isArray(learnersData) || learnersData.length === 0) {
            throw new Error('Learners data must be a non-empty array');
        }
        
        if (!adminId || isNaN(adminId)) {
            throw new Error('Valid admin ID is required');
        }

        // Verify admin and group exist
        const [admin, group] = await Promise.all([
            prisma.admin.findUnique({
                where: { id: adminId },
                select: { id: true }
            }),
            prisma.group.findUnique({
                where: { id: groupId },
                select: { id: true }
            })
        ]);
        if (!admin) throw new Error('Admin not found');
        if (!group) throw new Error('Group not found');

        // Get existing learners to avoid duplicates
        const existingLearners = await prisma.learner.findMany({
            where: {
                OR: learnersData.map(learner => ({
                    email: learner.email
                }))
            },
            select: { email: true, id: true }
        });

        // Get existing learner emails to avoid duplicates
        const existingEmails = new Set(existingLearners.map(learner => learner.email));

        // Filter out existing learners
        const newLearnersData = learnersData.filter(learner => !existingEmails.has(learner.email));

        // Create new learners and get their IDs
        let newLearnerIds = [];
        if (newLearnersData.length > 0) {
            // Create new learners and get their data with IDs
            const createdLearners = await Promise.all(newLearnersData.map(learner => 
                prisma.learner.create({
                    data: learner,
                    select: { id: true }
                })
            ));
            newLearnerIds = createdLearners.map(learner => learner.id);
        }

        // Get existing learner IDs
        const existingLearnerIds = existingLearners.map(learner => learner.id);

        // Combine all learner IDs
        const allLearnerIds = [...newLearnerIds, ...existingLearnerIds];

        // Add the learners to the group
        const groupMembers = await groupService.addMembersToGroup(groupId, allLearnerIds);

        // Queue welcome messages only for the newly created learners
        for (const learner of newLearnersData) {
            console.log(`Queueing welcome message for ${learner.name} (${learner.email})`);
            addJobToQueue(welcomeQueue, 'sendWelcomeMessage', { to: learner.number, name: learner.name });
        }
        
        return;
    } catch (error) {
        console.error("Learner creation error:", error); 
        throw new Error(`Failed to register learners: ${error.message}`);
    }
};


/**
 * Retrieve a single learner by ID
 * 
 * Fetches learner details from database by learner ID.
 * Used for profile viewing and learner management operations.
 * 
 * @param {string|number} learnerId - ID of the learner to retrieve
 * @returns {Object} Learner object with profile information
 * @throws {Error} If learner not found or database error occurs
 */
const getLearner = async (learnerId) => {
    try {
        // Find learner by ID
        const learner = await prisma.learner.findUnique({
            where: { id: learnerId }
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
 * Get all learners for a specific admin
 * 
 * Fetches all learners associated with a specific admin.
 * Used for admin management and reporting.
 * 
 * @param {number} adminId - The ID of the admin whose learners to fetch
 * @returns {Promise<Array>} Array of learner objects
 * @throws {Error} If database query fails or adminId is invalid
 */
const getAllLearners = async (adminId) => {
    try {
        if (!adminId || isNaN(adminId)) {
            throw new Error('Valid admin ID is required');
        }

        // Fetch all learners for the specified admin
        const learners = await prisma.learner.findMany({
            where: {
                adminId: Number(adminId)
            },
            orderBy: {
                createdAt: 'desc' // Newest first
            }
        });
        
        return learners;
    } catch (error) {
        console.error('Error in getAllLearners:', error);
        throw new Error(error.message || 'Failed to fetch learners');
    }
}

/**
 * Update learner profile information
 * 
 * Updates learner information including:
 * - Personal information (name, surname)
 * - Contact information (email, phone number)
 * - Organizational information (department, company)
 * 
 * Note: The 'active' status cannot be updated through this function.
 * Use dedicated activation/deactivation endpoints instead.
 * 
 * @param {string|number} userId - ID of learner to update
 * @param {Object} requestBody - Updated learner data
 * @param {string} [requestBody.name] - Updated first name
 * @param {string} [requestBody.surname] - Updated last name
 * @param {string} [requestBody.email] - Updated email address
 * @param {string} [requestBody.number] - Updated WhatsApp phone number
 * @param {string} [requestBody.department] - Updated department
 * @param {string} [requestBody.company] - Updated company name
 * @returns {Object} Updated learner object
 * @throws {Error} If learner not found or update fails
 */
const updateLearner = async (userId, requestBody) => {
    try {
        // Extract allowed fields from request body
        const {
            name,
            surname,
            email,
            number,
            department,
            company
        } = requestBody;

        // Build update data object with only provided fields
        const updatedData = {};
        if (name !== undefined) updatedData.name = name;
        if (surname !== undefined) updatedData.surname = surname;
        if (email !== undefined) updatedData.email = email;
        if (number !== undefined) updatedData.number = number;
        if (department !== undefined) updatedData.department = department;
        if (company !== undefined) updatedData.company = company;

        // Validate department if provided
        if (department && !['marketing', 'it', 'learning', 'other'].includes(department)) {
            throw new Error('Invalid department value');
        }
        
        // Update learner in database
        const learner = await prisma.learner.update({
            where: { id: Number(userId) }, // Convert to number for safety
            data: updatedData
        });
        
        // Check if learner was found and updated
        if (!learner) {
            throw new Error('Learner not found');
        }
        
        return learner; // Return updated learner
    } catch (error) {
        if (error.message === 'Invalid department value') {
            throw error;
        }
        // Handle Prisma unique constraint violations
        if (error.code === 'P2002') {
            throw new Error('Email address is already in use');
        }
        throw new Error('Failed to update learner information');
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
