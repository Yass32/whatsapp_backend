/**
 * Learner Service - Student Management
 * 
 * This service handles all learner (student) operations including:
 * - Learner registration and profile management
 * - CRUD operations for learner accounts
 * - Cascading deletion of learner-related data
 * - Integration with course enrollment and progress tracking
 */

const { PrismaClient } = require('@prisma/client');
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
            prisma.groupMember.deleteMany({}), // Delete group memberships
            prisma.lessonProgress.deleteMany({}), // Delete lesson progress
            prisma.enrollment.deleteMany({}), // Delete enrollment records second
            prisma.learner.deleteMany({}), // Delete learner records last
        ]);
    } catch (error) {
        console.error("Failed to delete all learners and their related data:", error);
        throw error; // Re-throw for caller handling
    }
}; 




const getLearnerInsights = async (adminId) => {
    try {
        // Get all learners for this admin
        const learners = await prisma.learner.findMany({
            where: { adminId: adminId },
            select: {
                id: true,
                name: true,
                surname: true,
                number: true,
                createdAt: true
            }
        });

        if (!learners || learners.length === 0) {
            return {
                success: true,
                message: 'No learners found',
                data: []
            };
        }

        // Get comprehensive insights for all learners
        const insights = [];

        for (const learner of learners) {
            // Get course progress for this learner
            const courseProgress = await prisma.courseProgress.findMany({
                where: { learnerId: learner.id },
                include: {
                    course: {
                        select: {
                            id: true,
                            name: true,
                            totalLessons: true,
                            totalQuizzes: true
                        }
                    }
                }
            });

            // Get lesson progress for this learner
            const lessonProgress = await prisma.lessonProgress.findMany({
                where: { learnerId: learner.id },
                include: {
                    lesson: {
                        select: {
                            id: true,
                            title: true,
                            day: true,
                            courseId: true
                        }
                    }
                }
            });

            // Get quiz scores for this learner
            const quizScores = await prisma.lessonProgress.findMany({
                where: {
                    learnerId: learner.id,
                    quizScore: { not: null }
                },
                select: {
                    quizScore: true,
                    lesson: {
                        select: {
                            id: true,
                            title: true
                        }
                    }
                }
            });

            // Get message interactions for this learner
            // Only include message contexts that have valid course, lesson, AND quiz references
            // This ensures we only get quiz-related message interactions, not general messages
            const messageContexts = await prisma.messageContext.findMany({
                where: {
                    phoneNumber: learner.number,
                    courseId: { not: null }, // Filter for valid course references
                    lessonId: { not: null }, // Filter for valid lesson references
                    quizId: { not: null }    // Filter for valid quiz references (quiz interactions only)
                },
                include: {
                    message: {
                        select: {
                            id: true,
                            body: true,
                            status: true,
                            createdAt: true
                        }
                    },
                    course: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    lesson: {
                        select: {
                            id: true,
                            title: true
                        }
                    },
                    quiz: {
                        select: {
                            id: true,
                            question: true,
                            correctOption: true
                        }
                    }
                }
            });

            // Calculate insights for this learner
            const completedCourses = courseProgress.filter(cp => cp.completedAt).length;
            const totalProgressPercent = courseProgress.length > 0
                ? courseProgress.reduce((sum, cp) => sum + (cp.progressPercent || 0), 0) / courseProgress.length
                : 0;
            const averageQuizScore = quizScores.length > 0
                ? quizScores.reduce((sum, qs) => sum + (qs.quizScore || 0), 0) / quizScores.length
                : 0;

            const totalMessages = messageContexts.length;
            const successfulMessages = messageContexts.filter(mc => mc.message?.status === 'delivered' || mc.message?.status === 'read').length;

            insights.push({
                learner: {
                    id: learner.id,
                    name: learner.name,
                    surname: learner.surname,
                    number: learner.number,
                    joinedAt: learner.createdAt
                },
                recentActivity: {
                    courseProgress: courseProgress.map(cp => ({
                        courseId: cp.course.id,
                        courseName: cp.course.name,
                        progressPercent: cp.progressPercent || 0,
                        completedAt: cp.completedAt,
                        completedLessons: cp.completedLessons || 0
                    })),
                    lessonProgress: lessonProgress.map(lp => ({
                        lessonId: lp.lesson.id,
                        lessonTitle: lp.lesson.title,
                        courseId: lp.lesson.courseId,
                        completedAt: lp.completedAt,
                        quizScore: lp.quizScore,
                        quizReply: lp.quizReply
                    })),
                    messageHistory: messageContexts.map(mc => ({
                        //courseId: mc.courseId,
                        //courseName: mc.course?.name,
                        //lessonId: mc.lessonId,
                        //lessonTitle: mc.lesson?.title,
                        messageBody: mc.message.body,
                        messageStatus: mc.message.status,
                        ...(mc.message.status === 'read' ? { readAt: mc.message.createdAt } : { deliveredAt: mc.message.createdAt }),
                        quizCorrectOption: mc.quiz?.correctOption,
                    }))
                },
                statistics: {
                    totalCourses: courseProgress.length,
                    completedCourses: completedCourses,
                    inProgressCourses: courseProgress.length - completedCourses,
                    //averageProgress: Math.round(totalProgressPercent * 100) / 100,
                    totalLessonsCompleted: lessonProgress.filter(lp => lp.completedAt).length,
                    //totalQuizzesAttempted: quizScores.length,
                    //averageQuizScore: Math.round(averageQuizScore * 100) / 100,
                    //totalMessages: totalMessages,
                    //successfulMessageRate: totalMessages > 0 ? Math.round((successfulMessages / totalMessages) * 100) : 0
                },
            });
        }

        /*
        summary: {
                totalLearners: learners.length,
                averageProgress: insights.length > 0
                    ? Math.round((insights.reduce((sum, i) => sum + i.statistics.averageProgress, 0) / insights.length) * 100) / 100
                    : 0,
                averageQuizScore: insights.length > 0
                    ? Math.round((insights.reduce((sum, i) => sum + i.statistics.averageQuizScore, 0) / insights.length) * 100) / 100
                    : 0,
                totalMessages: insights.reduce((sum, i) => sum + i.statistics.totalMessages, 0)
            }

        */

        return {
            message: 'Learner insights retrieved successfully',
            insights,            
        };

    } catch (error) {
        console.error('Error in getLearnerInsights:', error);
        throw new Error(`Failed to fetch learner insights: ${error.message}`);
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
