/**
 * Group Service - Group Management
 * 
 * This service handles all group-related operations including:
 * - Group creation and management
 * - Member management (adding/removing learners)
 * - Course assignment to groups
 * - Bulk operations for efficiency
 */

//const { PrismaClient } = require('../generated/prisma');
const { PrismaClient } = require('@prisma/client');
const { withAccelerate } = require('@prisma/extension-accelerate');

// Initialize Prisma client with Accelerate extension
const prisma = new PrismaClient().$extends(withAccelerate());

/**
 * Create a new group
 * 
 * @param {Object} groupData Group creation data
 * @param {string} groupData.name Group name
 * @param {string} [groupData.description] Optional group description
 * @param {number} groupData.adminId ID of the admin creating the group
 * @returns {Promise<Object>} Created group object
 */
const createGroup = async (groupData) => {
    try {
        const group = await prisma.group.create({
            data: groupData
        });
        return group;
    } catch (error) {
        console.error('Group creation error:', error);
        throw new Error('Failed to create group');
    }
};

/**
 * Add multiple learners to a group
 * 
 * @param {number} groupId Group ID
 * @param {number[]} learnerIds Array of learner IDs to add
 * @returns {Promise<Object>} Object containing count of added members
 */
const addMembersToGroup = async (groupId, learnerIds) => {
    try {
        // Validate input
        if (!groupId || isNaN(Number(groupId))) {
            throw new Error('Valid group ID is required');
        }
        
        if (!Array.isArray(learnerIds) || learnerIds.length === 0) {
            throw new Error('Learner IDs must be a non-empty array');
        }

        // First, verify the group exists
        const group = await prisma.group.findUnique({
            where: { id: groupId }
        });

        if (!group) {
            throw new Error('Group not found');
        }

        console.log("learnerIds from groupservice", learnerIds);

        // Verify all learners exist
        const existingLearners = await prisma.learner.findMany({
            where: { id: { in: learnerIds } },
            select: { id: true }
        });

        if (existingLearners.length !== learnerIds.length) {
            const foundIds = new Set(existingLearners.map(learner => learner.id));
            const missingIds = learnerIds.filter(id => !foundIds.has(id));
            throw new Error(`Learners not found: ${missingIds.join(', ')}`);
        }

        // Get existing memberships to avoid duplicates
        const existingMembers = await prisma.groupMember.findMany({
            where: {
                groupId,
                learnerId: { in: learnerIds }
            },
            select: { learnerId: true }
        });

        // Filter out already existing members
        const existingLearnerIds = new Set(existingMembers.map(member => member.learnerId));
        const newLearnerIds = learnerIds.filter(id => !existingLearnerIds.has(id));

        if (newLearnerIds.length === 0) {
            return { 
                success: true, 
                count: 0, 
                message: 'All learners already in group',
                data: []
            };
        }

        // Add new members in bulk
        const result = await prisma.groupMember.createMany({
            data: newLearnerIds.map(learnerId => ({
                groupId,
                learnerId
            }))
        });

        return { 
            success: true, 
            count: result.count, 
            message: 'Members added successfully',
            data: result
        };
    } catch (error) {
        console.error('Add members error:', error);
        throw new Error(`Failed to add members to group: ${error.message}`);
    }
};

/**
 * Remove members from a group
 * 
 * @param {number} groupId Group ID
 * @param {number[]} learnerIds Array of learner IDs to remove
 * @returns {Promise<Object>} Object containing count of removed members
 */
const removeMembersFromGroup = async (groupId, learnerIds) => {
    try {
        // Validate input
        if (!groupId || isNaN(Number(groupId))) {
            throw new Error('Valid group ID is required');
        }
        
        if (!Array.isArray(learnerIds) || learnerIds.length === 0) {
            throw new Error('Learner IDs must be a non-empty array');
        }

        // Verify group exists
        const group = await prisma.group.findUnique({
            where: { id: groupId },
            select: { id: true }
        });

        if (!group) {
            throw new Error('Group not found');
        }

        const result = await prisma.groupMember.deleteMany({
            where: {
                groupId,
                learnerId: { in: learnerIds }
            }
        });

        if (result.count === 0) {
            return { 
                success: true, 
                count: 0, 
                message: 'No members found to remove',
                data: result
            };
        }

        return { 
            success: true, 
            count: result.count, 
            message: 'Members removed successfully',
            data: result
        };
    } catch (error) {
        console.error('Remove members error:', error);
        throw new Error(`Failed to remove members from group: ${error.message}`);
    }
};

/**
 * Assign courses to a group
 * 
 * @param {number} groupId Group ID
 * @param {number[]} courseIds Array of course IDs to assign
 * @returns {Promise<Object>} Object containing count of assigned courses
 */
const assignCoursesToGroup = async (groupId, courseIds) => {
    try {
        // Validate input
        if (!groupId || isNaN(Number(groupId))) {
            throw new Error('Valid group ID is required');
        }
        
        if (!Array.isArray(courseIds) || courseIds.length === 0) {
            throw new Error('Course IDs must be a non-empty array');
        }

        // First, verify the group exists
        const group = await prisma.group.findUnique({
            where: { id: groupId }
        });

        if (!group) {
            throw new Error('Group not found');
        }

        // Get existing assignments to avoid duplicates
        const existingAssignments = await prisma.groupCourse.findMany({
            where: {
                groupId,
                courseId: { in: courseIds }
            },
            select: { courseId: true }
        });

        const existingCourseIds = new Set(existingAssignments.map(a => a.courseId));
        const newCourseIds = courseIds.filter(id => !existingCourseIds.has(id));

        if (newCourseIds.length === 0) {
            return { 
                success: true,
                count: 0,
                message: 'All courses already assigned to group',
                data: []
            };
        }

        // Assign new courses in bulk
        const result = await prisma.groupCourse.createMany({
            data: newCourseIds.map(courseId => ({
                groupId,
                courseId
            }))
        });

        return { 
            success: true,
            count: result.count,
            message: 'Courses assigned successfully',
            data: result
        };
    } catch (error) {
        console.error('Assign courses error:', error);
        throw new Error(`Failed to assign courses to group: ${error.message}`);
    }
};

/**
 * Remove course assignments from a group
 * 
 * @param {number} groupId Group ID
 * @param {number[]} courseIds Array of course IDs to remove
 * @returns {Promise<Object>} Object containing count of removed assignments
 */
const removeCoursesFromGroup = async (groupId, courseIds) => {
    try {
        // Validate input
        if (!groupId || isNaN(Number(groupId))) {
            throw new Error('Valid group ID is required');
        }
        
        if (!Array.isArray(courseIds) || courseIds.length === 0) {
            throw new Error('Course IDs must be a non-empty array');
        }

        // Verify group exists
        const group = await prisma.group.findUnique({
            where: { id: groupId },
            select: { id: true }
        });

        if (!group) {
            throw new Error('Group not found');
        }

        const result = await prisma.groupCourse.deleteMany({
            where: {
                groupId,
                courseId: { in: courseIds }
            }
        });

        if (result.count === 0) {
            return { 
                success: true,
                count: 0,
                message: 'No course assignments found to remove',
                data: result
            };
        }

        return { 
            success: true,
            count: result.count,
            message: 'Course assignments removed successfully',
            data: result
        };
    } catch (error) {
        console.error('Remove courses error:', error);
        throw new Error(`Failed to remove courses from group: ${error.message}`);
    }
};

/**
 * Get group details with members and courses
 * 
 * @param {number} groupId Group ID
 * @returns {Promise<Object>} Group object with members and courses
 */
const getGroupDetails = async (groupId) => {
    try {
        const group = await prisma.group.findUnique({
            where: { id: groupId },
            include: {
                members: {
                    include: {
                        learner: {  //learner: true
                            select: {
                                id: true,
                                name: true,
                                surname: true,
                                email: true,
                                number: true,
                                active: true
                            }
                        }
                    }
                },
                courses: {
                    include: {
                        course: {   //course: true
                            select: {
                                id: true,
                                name: true,
                                description: true,
                                totalLessons: true,
                                totalQuizzes: true,
                                status: true
                            }
                        }
                    }
                }
            }
        });

        if (!group) {
            throw new Error('Group not found');
        }

        return group;
    } catch (error) {
        console.error('Get group details error:', error);
        throw new Error('Failed to get group details');
    }
};

/**
 * Get all groups for an admin with detailed member information
 * 
 * Returns all groups created by the admin including:
 * - Basic group information
 * - Member details (name, email, etc.)
 * - Course assignments
 * - Member and course counts
 * 
 * @param {number} adminId Admin ID
 * @returns {Promise<Array>} Array of group objects with detailed information
 * 
 * 
 * [
  {
    id: 1,
    name: "Marketing Team",
    description: "Marketing department group",
    createdAt: "2025-09-09T...",
    updatedAt: "2025-09-09T...",
    stats: {
      totalMembers: 5,
      totalCourses: 2
    },
    members: [
      {
        id: 1,
        name: "John",
        surname: "Doe",
        email: "john@example.com",
        number: "+1234567890",
        department: "marketing",
        company: "ACME Inc",
        active: true,
        joinedAt: "2025-09-09T..."
      },
      // ... other members
    ],
    courses: [
      {
        id: 1,
        name: "Marketing 101",
        description: "Introduction to Marketing",
        totalLessons: 10,
        totalQuizzes: 5,
        assignedAt: "2025-09-09T..."
      },
      // ... other courses
    ]
  },
  // ... other groups
]
 */

const getAdminGroups = async (adminId) => {
    try {
        const groups = await prisma.group.findMany({
            where: { adminId },
            include: {
                members: {
                    include: {
                        learner: {
                            select: {
                                id: true,
                                name: true,
                                surname: true,
                                email: true,
                                number: true,
                                active: true
                            }
                        }
                    }
                },
                courses: {
                    include: {
                        course: {
                            select: {
                                id: true,
                                name: true,
                                description: true,
                                totalLessons: true,
                                totalQuizzes: true
                            }
                        }
                    }
                },
                _count: {
                    select: {
                        members: true,
                        courses: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc' // Most recent groups first
            }
        });

        // Transform the response to a more friendly format
        const formattedGroups = groups.map(group => ({
            id: group.id,
            name: group.name,
            createdAt: group.createdAt,
            updatedAt: group.updatedAt,
            stats: {
                totalMembers: group._count.members,
                totalCourses: group._count.courses
            },
            members: group.members.map(member => ({
                id: member.learner.id,
                name: member.learner.name,
                surname: member.learner.surname,
                email: member.learner.email,
                number: member.learner.number,
                active: member.learner.active,
            })),
            courses: group.courses.map(course => ({
                id: course.course.id,
                name: course.course.name,
                description: course.course.description,
                //totalLessons: course.course.totalLessons,
                //totalQuizzes: course.course.totalQuizzes,
            }))
        }));

        return formattedGroups;
    } catch (error) {
        console.error('Get admin groups error:', error);
        throw new Error('Failed to get admin groups');
    }
};

/**
 * Update group information
 * 
 * @param {number} groupId Group ID
 * @param {Object} updateData Updated group data
 * @returns {Promise<Object>} Updated group object
 */
const updateGroup = async (groupId, updateData) => {
    try {
        // Validate input
        if (!groupId || isNaN(Number(groupId))) {
            throw new Error('Valid group ID is required');
        }

        if (!updateData || Object.keys(updateData).length === 0) {
            throw new Error('Update data is required');
        }

        const group = await prisma.group.update({
            where: { id: groupId },
            data: updateData
        });

        return {
            group,
            message: 'Group updated successfully',
        };
    } catch (error) {
        console.error('Update group error:', error);
        if (error.code === 'P2025') {
            throw new Error('Group not found');
        }
        throw new Error(`Failed to update group: ${error.message}`);
    }
};

/**
 * Delete a group and all related data
 *
 * @param {number} groupId Group ID
 * @returns {Promise<Object>} Deleted group object
 */
const deleteGroup = async (groupId) => {
    // Input validation
    if (!groupId || isNaN(Number(groupId))) {
        throw new Error('Valid group ID is required');
    }

    return await prisma.$transaction(async (tx) => {
        try {
            // Delete group and get deleted data in one operation
            const deletedGroup = await tx.group.delete({
                where: { id: groupId },
                include: {
                    _count: {
                        select: {
                            members: true                        
                        }
                    }
                }
            });

            console.log(`Successfully deleted group: ${deletedGroup.name} (ID: ${deletedGroup.id})`);
            return {
                success: true,
                message: 'Group deleted successfully',
                data: deletedGroup
            };

        } catch (error) {
            console.error('Delete group error:', error);
            // Provide more specific error messages
            if (error.code === 'P2025') {
                throw new Error('Group not found or already deleted');
            }
            throw new Error(`Failed to delete group: ${error.message}`);
        }
    });
};

module.exports = {
    createGroup,
    addMembersToGroup,
    removeMembersFromGroup,
    assignCoursesToGroup,
    removeCoursesFromGroup,
    getGroupDetails,
    getAdminGroups,
    updateGroup,
    deleteGroup
};
