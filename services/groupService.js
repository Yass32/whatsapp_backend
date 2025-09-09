/**
 * Group Service - Group Management
 * 
 * This service handles all group-related operations including:
 * - Group creation and management
 * - Member management (adding/removing learners)
 * - Course assignment to groups
 * - Bulk operations for efficiency
 */

const { PrismaClient } = require('../generated/prisma');
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
        // First, verify the group exists
        const group = await prisma.group.findUnique({
            where: { id: groupId }
        });

        if (!group) {
            throw new Error('Group not found');
        }

        // Get existing memberships to avoid duplicates
        const existingMembers = await prisma.groupMember.findMany({
            where: {
                groupId,
                learnerId: { in: learnerIds }
            },
            select: { learnerId: true }
        });

        const existingLearnerIds = new Set(existingMembers.map(m => m.learnerId));
        const newLearnerIds = learnerIds.filter(id => !existingLearnerIds.has(id));

        if (newLearnerIds.length === 0) {
            return { count: 0 };
        }

        // Add new members in bulk
        const result = await prisma.groupMember.createMany({
            data: newLearnerIds.map(learnerId => ({
                groupId,
                learnerId
            }))
        });

        return { count: result.count };
    } catch (error) {
        console.error('Add members error:', error);
        throw new Error('Failed to add members to group');
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
        const result = await prisma.groupMember.deleteMany({
            where: {
                groupId,
                learnerId: { in: learnerIds }
            }
        });

        return { count: result.count };
    } catch (error) {
        console.error('Remove members error:', error);
        throw new Error('Failed to remove members from group');
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
            return { count: 0 };
        }

        // Assign new courses in bulk
        const result = await prisma.groupCourse.createMany({
            data: newCourseIds.map(courseId => ({
                groupId,
                courseId
            }))
        });

        return { count: result.count };
    } catch (error) {
        console.error('Assign courses error:', error);
        throw new Error('Failed to assign courses to group');
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
        const result = await prisma.groupCourse.deleteMany({
            where: {
                groupId,
                courseId: { in: courseIds }
            }
        });

        return { count: result.count };
    } catch (error) {
        console.error('Remove courses error:', error);
        throw new Error('Failed to remove courses from group');
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
                        learner: true
                    }
                },
                courses: {
                    include: {
                        course: true
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
 * Get all groups for an admin
 * 
 * @param {number} adminId Admin ID
 * @returns {Promise<Array>} Array of group objects
 */
const getAdminGroups = async (adminId) => {
    try {
        const groups = await prisma.group.findMany({
            where: { adminId },
            include: {
                _count: {
                    select: {
                        members: true,
                        courses: true
                    }
                }
            }
        });

        return groups;
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
        const group = await prisma.group.update({
            where: { id: groupId },
            data: updateData
        });

        return group;
    } catch (error) {
        console.error('Update group error:', error);
        throw new Error('Failed to update group');
    }
};

/**
 * Delete a group and all related data
 * 
 * @param {number} groupId Group ID
 * @returns {Promise<Object>} Deleted group object
 */
const deleteGroup = async (groupId) => {
    try {
        const group = await prisma.group.delete({
            where: { id: groupId }
        });

        return group;
    } catch (error) {
        console.error('Delete group error:', error);
        throw new Error('Failed to delete group');
    }
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
