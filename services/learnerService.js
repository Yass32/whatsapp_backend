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
// Initialize Prisma client with Accelerate extension for optimized queries
const prisma = new PrismaClient().$extends(withAccelerate())


/**
 * Create one or more new learner accounts in the system.
 * 
 * Registers new students/learners who can enroll in courses. This function
 * is designed for bulk creation and uses `createMany` for efficiency.
 * 
 * @param {Array<Object>} learnersData - An array of learner registration data objects.
 * @param {string} learnersData[].name - Learner's first name.
 * @param {string} learnersData[].surname - Learner's last name.
 * @param {string} learnersData[].email - Learner's unique email address.
 * @param {string} learnersData[].number - Learner's WhatsApp phone number.
 * @param {string} learnersData[].department - Learner's department.
 * @param {string} learnersData[].company - Learner's company.
 * @returns {Object} An object containing the count of created learners.
 * @throws {Error} If the bulk creation fails.
 */
const createLearner = async (learnersData) => {
    try {
        // Find which learners are actually new
        const incomingEmails = learnersData.map(learner => learner.email);
        console.log(`Incoming emails: ${incomingEmails}`);
        const existingLearners = await prisma.learner.findMany({
            where: {
                email: { in: incomingEmails },
            },
            select: {
                email: true, // Select only the email for efficiency
            },
        });
        console.log(`Existing learners: ${existingLearners}`);
        // Convert existing learners to a Set for O(1) lookups
        // This is more efficient than using `includes` in a loop
        const existingEmails = new Set(existingLearners.map(learner => learner.email));

        // Filter out existing learners
        const newLearnersData = learnersData.filter(learner => !existingEmails.has(learner.email));

        console.log(`New learners: ${newLearnersData}`);

        // If there are no new learners, return early
        if (newLearnersData.length === 0) {
            return { count: 0 };
        }

        // Create only the new learners
        const result = await prisma.learner.createMany({
            data: newLearnersData,
        });

        console.log(`Created ${result.count} new learners`);

        // Queue welcome messages only for the newly created learners
        for (const learner of newLearnersData) {
            console.log(`Queueing welcome message for ${learner.name} (${learner.email})`);
            addJobToQueue(welcomeQueue, 'sendWelcomeMessage', { to: learner.number, name: learner.name });
        }
        
        return result; // Returns { count: <number of learners created> }
    } catch (error) {
        console.error("Learner creation error:", error); 
        throw new Error('Failed to register learners');
    }
};


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
