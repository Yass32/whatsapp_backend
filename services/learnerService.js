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
const createLearner = async (learnersData, adminId) => {
    try {
        // Validate input
        if (!Array.isArray(learnersData) || learnersData.length === 0) {
            throw new Error('Learners data must be a non-empty array');
        }
        
        if (!adminId || isNaN(adminId)) {
            throw new Error('Valid admin ID is required');
        }

        // Verify admin and group exist
        const admin = await prisma.admin.findUnique({
            where: { id: adminId },
            select: { id: true }
        });
        if (!admin) throw new Error('Admin not found');

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

        // Queue welcome messages only for the newly created learners
        for (const learner of newLearnersData) {
            console.log(`Queueing welcome message for ${learner.name} (${learner.email})`);
            addJobToQueue(welcomeQueue, 'sendWelcomeMessage', { to: learner.number, name: learner.name });
        }
        
        return { 
            count: newLearnersData.length,
            message: 'Learners registered successfully',
            data: newLearnersData
        };
    } catch (error) {
        console.error("Learner creation error:", error); 
        throw new Error(`Failed to register learners: ${error.message}`);
    }
};


/**
 * Retrieve a single learner by ID with comprehensive information
 *
 * Fetches learner details from database by learner ID including:
 * - Basic learner information
 * - Enrolled courses with lesson details
 * - Group memberships
 * - Course progress tracking
 * - Individual lesson progress
 * Used for detailed learner profile viewing and analytics.
 *
 * @param {string|number} learnerId - ID of the learner to retrieve
 * @returns {Object} Learner object with complete information including courses, lessons, groups, and progress
 * @throws {Error} If learner not found or database error occurs
 */
const getLearner = async (learnerId) => {
    try {
        // Find learner by ID with all related information
        const learner = await prisma.learner.findUnique({
            where: { id: Number(learnerId) },
            include: {
                // Include enrolled courses with their lessons and quizzes
                enrollments: {
                    include: {
                        course: {
                            include: {
                                lessons: {
                                    include: {
                                        quiz: true // Include quizzes for each lesson
                                    },
                                    orderBy: {
                                        day: 'asc' // Order lessons by day
                                    }
                                },
                            }
                        }
                    }
                },
                // Include course progress for each enrolled course
                courseProgress: {
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
                },
                // Include individual lesson progress
                lessonProgress: {
                    include: {
                        lesson: {
                            include: {
                                course: {
                                    select: {
                                        id: true,
                                        name: true
                                    }
                                },
                                quiz: true
                            }
                        }
                    }
                },
                // Include group memberships
                groups: {
                    include: {
                        group: {
                            select: {
                                id: true,
                                name: true,
                            }
                        }
                    }
                }
            }
        });

        // Check if learner exists
        if (!learner) {
            throw new Error('Learner not found');
        }

        // Calculate additional analytics data
        const analytics = {
            totalEnrolledCourses: learner.enrollments.length,
            totalCompletedCourses: learner.courseProgress.filter(cp => cp.isCompleted).length,
            totalLessonsCompleted: learner.lessonProgress.filter(lp => lp.isCompleted).length,
            totalGroupsJoined: learner.groups.length,
            averageCourseProgress: learner.courseProgress.length > 0
                ? Math.round(learner.courseProgress.reduce((sum, cp) => sum + (cp.progressPercent || 0), 0) / learner.courseProgress.length)
                : 0,
            averageQuizScore: learner.courseProgress.length > 0
                ? Math.round(learner.courseProgress.reduce((sum, cp) => sum + (cp.quizScore || 0), 0) / learner.courseProgress.length)
                : 0
        };

        // Extract only group details from GroupMember objects
        const groupsData = learner.groups.map(membership => membership.group);

        // Create modified learner object with clean groups data
        const { groups, courseProgress, lessonProgress, enrollments } = learner;

        const learnerData = { name: learner.name,
            surname: learner.surname,
            email: learner.email,
            number: learner.number,
            active: learner.active,
            createdAt: learner.createdAt,
        };
            

        return {
            groups: groupsData, // Clean group objects without GroupMember wrapper
            courseProgress,
            lessonProgress,
            enrollments,
            analytics,
            learnerData
        };
    } catch (error) {
        console.error('Error in getLearner:', error);
        throw new Error(error.message || 'Failed to fetch learner details');
    }
};

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
                adminId
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
 * @returns {Object} Updated learner object
 * @throws {Error} If learner not found or update fails
 */
const updateLearner = async (userId, requestBody) => {
    try {
        // Extract allowed fields from request body
        const { name, surname, email, number } = requestBody;

        // Prepare update data with only provided fields
        const updateData = {};
        if (name) updateData.name = name;
        if (surname) updateData.surname = surname;
        if (email) updateData.email = email;
        if (number) updateData.number = number;

        // Validate that at least one field is provided
        if (Object.keys(updateData).length === 0) {
            throw new Error('No fields provided for update');
        }
        
        // Update learner in database
        const learner = await prisma.learner.update({
            where: { id: Number(userId) }, // Convert to number for safety
            data: updateData
        });
        
        // Check if learner was found and updated
        if (!learner) {
            throw new Error('Learner not found');
        }
        
        return learner; // Return updated learner
    } catch (error) {
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
 * Permanently removes learner from database along with all related data:
 * 1. Group memberships (GroupMember records)
 * 2. Course progress records
 * 3. Lesson progress records
 * 4. Course enrollments
 * 5. Learner record
 *
 * Uses transaction to ensure atomicity and proper cascading deletion.
 *
 * @param {string|number} learnerId - ID of learner to delete
 * @returns {Object} Deleted learner object
 * @throws {Error} If learner not found or deletion fails
 */
const deleteLearner = async (learnerId) => {
    // Input validation
    if (!learnerId || isNaN(Number(learnerId))) {
        throw new Error('Valid learner ID is required');
    }

    return await prisma.$transaction(async (tx) => {
        try {
            // First verify the learner exists
            const learner = await tx.learner.findUnique({
                where: { id: Number(learnerId) },
                select: { id: true, name: true, surname: true }
            });

            if (!learner) {
                throw new Error('Learner not found');
            }

            console.log(`Deleting learner: ${learner.name} ${learner.surname} (ID: ${learner.id})`);

            // Delete all related data in correct order to respect foreign key constraints
            await tx.groupMember.deleteMany({
                where: { learnerId: Number(learnerId) }
            });

            await tx.courseProgress.deleteMany({
                where: { learnerId: Number(learnerId) }
            });

            await tx.lessonProgress.deleteMany({
                where: { learnerId: Number(learnerId) }
            });

            await tx.enrollment.deleteMany({
                where: { learnerId: Number(learnerId) }
            });

            // Finally, delete the learner
            const deletedLearner = await tx.learner.delete({
                where: { id: Number(learnerId) }
            });

            console.log(`Successfully deleted learner: ${deletedLearner.name} ${deletedLearner.surname}`);
            return {
                success: true,
                message: 'Learner deleted successfully',
                data: deletedLearner
            };

        } catch (error) {
            console.error('Delete learner error:', error);
            // Provide more specific error messages
            if (error.code === 'P2025') {
                throw new Error('Learner not found or already deleted');
            }
            throw new Error(`Failed to delete learner: ${error.message}`);
        }
    });
}; 

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
            const messageContexts = await prisma.messageContext.findMany({
                where: {
                    phoneNumber: learner.number,
                    courseId: { gt: 0 }, // courseId is Int (not nullable), so use gt: 0 instead of not: null
                    lessonId: { gt: 0 },
                    quizId: { gt: 0 }
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
    deleteAllLearners, // Function to delete all learners with cascading cleanup
    getLearnerInsights // Function to get comprehensive learner analytics and insights
}
