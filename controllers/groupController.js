/**
 * Group Controller - HTTP Request Handlers for Group Management
 * 
 * This controller handles all HTTP requests for group operations:
 * - Group CRUD operations
 * - Member management
 * - Course assignments
 * - Bulk operations
 */

const groupService = require('../services/groupService');

/**
 * Create a new group
 * 
 * @param {Object} request Express request object
 * @param {Object} response Express response object
 */
const createGroup = async (request, response) => {
    try {
        const groupData = {
            name: request.body.name,
            description: request.body.description,
            adminId: request.user.userId // From JWT token
        };

        // Validate required fields
        if (!groupData.name) {
            return response.status(400).json({
                status: 'error',
                message: 'Group name is required'
            });
        }

        const group = await groupService.createGroup(groupData);
        
        response.status(201).json({
            status: 'success',
            data: group
        });
    } catch (error) {
        response.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

/**
 * Add members to a group
 * 
 * @param {Object} request Express request object
 * @param {Object} response Express response object
 */
const addGroupMembers = async (request, response) => {
    try {
        const { groupId } = request.params;
        const { learnerIds } = request.body;

        // Validate input
        if (!Array.isArray(learnerIds) || learnerIds.length === 0) {
            return response.status(400).json({
                status: 'error',
                message: 'Please provide an array of learner IDs'
            });
        }

        const result = await groupService.addMembersToGroup(
            parseInt(groupId),
            learnerIds.map(id => parseInt(id))
        );

        response.status(200).json({
            status: 'success',
            data: result
        });
    } catch (error) {
        response.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

/**
 * Remove members from a group
 * 
 * @param {Object} request Express request object
 * @param {Object} response Express response object
 */
const removeGroupMembers = async (request, response) => {
    try {
        const { groupId } = request.params;
        const { learnerIds } = request.body;

        // Validate input
        if (!Array.isArray(learnerIds) || learnerIds.length === 0) {
            return response.status(400).json({
                status: 'error',
                message: 'Please provide an array of learner IDs'
            });
        }

        const result = await groupService.removeMembersFromGroup(
            parseInt(groupId),
            learnerIds.map(id => parseInt(id))
        );

        response.status(200).json({
            status: 'success',
            data: result
        });
    } catch (error) {
        response.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

/**
 * Assign courses to a group
 * 
 * @param {Object} request Express request object
 * @param {Object} response Express response object
 */
const assignGroupCourses = async (request, response) => {
    try {
        const { groupId } = request.params;
        const { courseIds } = request.body;

        // Validate input
        if (!Array.isArray(courseIds) || courseIds.length === 0) {
            return response.status(400).json({
                status: 'error',
                message: 'Please provide an array of course IDs'
            });
        }

        const result = await groupService.assignCoursesToGroup(
            parseInt(groupId),
            courseIds.map(id => parseInt(id))
        );

        response.status(200).json({
            status: 'success',
            data: result
        });
    } catch (error) {
        response.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

/**
 * Remove courses from a group
 * 
 * @param {Object} request Express request object
 * @param {Object} response Express response object
 */
const removeGroupCourses = async (request, response) => {
    try {
        const { groupId } = request.params;
        const { courseIds } = request.body;

        // Validate input
        if (!Array.isArray(courseIds) || courseIds.length === 0) {
            return response.status(400).json({
                status: 'error',
                message: 'Please provide an array of course IDs'
            });
        }

        const result = await groupService.removeCoursesFromGroup(
            parseInt(groupId),
            courseIds.map(id => parseInt(id))
        );

        response.status(200).json({
            status: 'success',
            data: result
        });
    } catch (error) {
        response.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

/**
 * Get group details
 * 
 * @param {Object} request Express request object
 * @param {Object} response Express response object
 */
const getGroupDetails = async (request, response) => {
    try {
        const { groupId } = request.params;
        const group = await groupService.getGroupDetails(parseInt(groupId));

        response.status(200).json({
            status: 'success',
            data: group
        });
    } catch (error) {
        response.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

/**
 * Get all groups for the current admin
 * 
 * @param {Object} request Express request object
 * @param {Object} response Express response object
 */
const getAdminGroups = async (request, response) => {
    try {
        const adminId = request.user.userId; // From JWT token
        const groups = await groupService.getAdminGroups(adminId);

        response.status(200).json({
            status: 'success',
            data: groups
        });
    } catch (error) {
        response.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

/**
 * Update group information
 * 
 * @param {Object} request Express request object
 * @param {Object} response Express response object
 */
const updateGroup = async (request, response) => {
    try {
        const { groupId } = request.params;
        const updateData = {
            name: request.body.name,
            description: request.body.description
        };

        // Remove undefined fields
        Object.keys(updateData).forEach(key => 
            updateData[key] === undefined && delete updateData[key]
        );

        // Validate that there's data to update
        if (Object.keys(updateData).length === 0) {
            return response.status(400).json({
                status: 'error',
                message: 'No valid update data provided'
            });
        }

        const group = await groupService.updateGroup(parseInt(groupId), updateData);

        response.status(200).json({
            status: 'success',
            data: group
        });
    } catch (error) {
        response.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

/**
 * Delete a group
 * 
 * @param {Object} request Express request object
 * @param {Object} response Express response object
 */
const deleteGroup = async (request, response) => {
    try {
        const { groupId } = request.params;
        const group = await groupService.deleteGroup(parseInt(groupId));

        response.status(200).json({
            status: 'success',
            data: group
        });
    } catch (error) {
        response.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

module.exports = {
    createGroup,
    addGroupMembers,
    removeGroupMembers,
    assignGroupCourses,
    removeGroupCourses,
    getGroupDetails,
    getAdminGroups,
    updateGroup,
    deleteGroup
};
