/**
 * WhatsApp Controller - HTTP Request Handlers for WhatsApp Message Sending
 * 
 * This controller handles HTTP requests for sending various types of WhatsApp messages:
 * - Text messages for simple communication
 * - Template messages for structured content
 * - Image messages with optional captions
 * - Interactive messages for quizzes and buttons
 */

const whatsappService = require('../services/whatsappService');

/**
 * Send text message via WhatsApp
 * 
 * Handles POST requests to send plain text messages:
 * - Validates required fields (recipient and message)
 * - Sends message through WhatsApp Business API
 * - Returns success confirmation with message details
 * 
 * @param {Object} request - Express request object
 * @param {Object} request.body - Request body
 * @param {string} request.body.to - Recipient's WhatsApp phone number
 * @param {string} request.body.message - Text message content
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with result or error
 */
const sendTextMessage = async (request, response) => {
    // Extract message parameters from request body
    const { to, message } = request.body;
    
    try {
        // Validate required fields
        if (!to || !message) {
            return response.status(400).json({
                error: 'Bad Request',
                message: 'Both "to" and "message" fields are required'
            });
        }

        // Call service layer to send text message
        const result = await whatsappService.sendTextMessage(to, message);
        
        // Return success response
        response.status(200).json({
            success: true,
            message: 'Text message sent successfully',
            data: result
        });
    } catch (error) {
        // Return error response if sending fails
        response.status(500).json({ error: error.message });
    }
}

/**
 * Send template message via WhatsApp
 * 
 * Handles POST requests to send pre-approved template messages:
 * - Validates required fields (recipient and template name)
 * - Supports parameterized templates with dynamic content
 * - Uses WhatsApp-approved message templates
 * - Includes language code and parameter substitution
 * 
 * @param {Object} request - Express request object
 * @param {Object} request.body - Request body
 * @param {string} request.body.to - Recipient's WhatsApp phone number
 * @param {string} request.body.templateName - Name of approved template
 * @param {string} [request.body.languageCode] - Template language code
 * @param {Array} [request.body.parameters] - Template parameter values
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with result or error
 */
const sendTemplateMessage = async (request, response) => {
    try {
        // Extract template message parameters from request body
        const { to, templateName, languageCode, parameters } = request.body;
        
        // Validate required fields
        if (!to || !templateName) {
            return response.status(400).json({
                error: 'Bad Request',
                message: 'Both "to" and "templateName" fields are required'
            });
        }
        
        // Call service layer to send template message
        const result = await whatsappService.sendTemplateMessage(
            to, 
            templateName, 
            languageCode, 
            parameters
        );
        
        // Return success response
        response.status(200).json({
            success: true,
            message: 'Template message sent successfully',
            data: result
        });
    } catch (error) {
        // Log error and return error response
        console.error('Error in sendTemplateMessage:', error.message);
        response.status(500).json({
            error: 'Internal Server Error', 
            message: error.message
        });
    }
};

/**
 * Send image message via WhatsApp
 * 
 * Handles POST requests to send image messages:
 * - Validates required fields (recipient and image URL)
 * - Supports optional caption text
 * - Sends image from publicly accessible URL
 * - Used for visual learning content and media
 * 
 * @param {Object} request - Express request object
 * @param {Object} request.body - Request body
 * @param {string} request.body.to - Recipient's WhatsApp phone number
 * @param {string} request.body.imageUrl - URL of image to send
 * @param {string} [request.body.caption] - Optional caption text
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with result or error
 */
const sendImageMessage = async (request, response) => {
    // Extract image message parameters from request body
    const { to, imageUrl, caption } = request.body;
    
    try {
        // Validate required fields
        if (!to || !imageUrl) {
            return response.status(400).json({
                error: 'Bad Request',
                message: 'Both "to" and "imageUrl" fields are required'
            });
        }

        // Call service layer to send image message
        const result = await whatsappService.sendImageMessage(to, imageUrl, caption);
        
        // Return success response
        response.status(200).json({
            success: true,
            message: 'Image message sent successfully',
            data: result
        });
    } catch (error) {
        // Return error response if sending fails
        response.status(500).json({ error: error.message });
    }
}

/**
 * Send interactive message via WhatsApp
 * 
 * Handles POST requests to send interactive messages with buttons:
 * - Validates required fields (recipient and question)
 * - Creates interactive buttons for user responses
 * - Used for quizzes, polls, and user engagement
 * - Supports multiple choice options (up to 3 buttons)
 * 
 * @param {Object} request - Express request object
 * @param {Object} request.body - Request body
 * @param {string} request.body.to - Recipient's WhatsApp phone number
 * @param {string} request.body.quizQuestion - Question or prompt text
 * @param {Array} [request.body.options] - Array of button options (max 3)
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with result or error
 */
const sendInteractiveMessage = async (request, response) => {
    // Extract interactive message parameters from request body
    const { to, quizQuestion, options } = request.body;
    
    try {
        // Validate required fields
        if (!to || !quizQuestion) {
            return response.status(400).json({
                error: 'Bad Request',
                message: 'Both "to" and "quizQuestion" fields are required'
            });
        }

        // Call service layer to send interactive message
        const result = await whatsappService.sendInteractiveMessage(to, quizQuestion, options);
        
        // Return success response
        response.status(200).json({
            success: true,
            message: 'Interactive message sent successfully',
            data: result
        });
    } catch (error) {
        // Return error response if sending fails
        response.status(500).json({ error: error.message });
    }
};

/**
 * Send interactive list message via WhatsApp
 * 
 * Handles POST requests to send interactive list messages:
 * - Validates required fields (recipient and question)
 * - Creates a dropdown list of options for user responses
 * - Used for quizzes with more than 3 options
 * - Supports unlimited options (unlike button messages which are limited to 3)
 * 
 * @param {Object} request - Express request object
 * @param {Object} request.body - Request body
 * @param {string} request.body.to - Recipient's WhatsApp phone number
 * @param {string} request.body.quizQuestion - Question or prompt text
 * @param {Array} request.body.options - Array of answer options (can be more than 3)
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with result or error
 */
const sendInteractiveListMessage = async (request, response) => {
    // Extract interactive list message parameters from request body
    const { to, quizQuestion, options } = request.body;
    
    try {
        // Validate required fields
        if (!to || !quizQuestion) {
            return response.status(400).json({
                error: 'Bad Request',
                message: 'Both "to" and "quizQuestion" fields are required'
            });
        }

        // Validate that options are provided and is an array with at least 2 items
        if (!Array.isArray(options) || options.length < 2) {
            return response.status(400).json({
                error: 'Bad Request',
                message: 'At least 2 options are required in an array format'
            });
        }

        // Call service layer to send interactive list message
        const result = await whatsappService.sendInteractiveListMessage(to, quizQuestion, options);
        
        // Return success response
        response.status(200).json({
            success: true,
            message: 'Interactive list message sent successfully',
            data: result
        });
    } catch (error) {
        // Log the error for debugging
        console.error('Error in sendInteractiveListMessage:', error);
        
        // Return error response if sending fails
        response.status(500).json({ 
            error: 'Failed to send interactive list message',
            details: error.message 
        });
    }
}

/**
 * Send document message via WhatsApp
 * 
 * Handles POST requests to send document messages:
 * - Validates required fields (recipient and document URL)
 * - Supports optional filename and caption
 * - Sends document from publicly accessible URL
 * - Used for sharing course materials and documents
 * 
 * @param {Object} request - Express request object
 * @param {Object} request.body - Request body
 * @param {string} request.body.to - Recipient's WhatsApp phone number
 * @param {string} request.body.documentUrl - URL of document to send
 * @param {string} [request.body.filename] - Optional custom filename
 * @param {string} [request.body.caption] - Optional caption text
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with result or error
 */
const sendDocument = async (request, response) => {
    // Extract document message parameters from request body
    const { to, documentUrl, filename, caption } = request.body;
    
    try {
        // Validate required fields
        if (!to || !documentUrl) {
            return response.status(400).json({
                error: 'Bad Request',
                message: 'Both "to" and "documentUrl" fields are required'
            });
        }

        // Call service layer to send document message
        const result = await whatsappService.sendDocument(to, documentUrl, filename, caption);
        
        // Return success response
        response.status(200).json({
            success: true,
            message: 'Document sent successfully',
            data: result
        });
    } catch (error) {
        // Return error response if sending fails
        response.status(500).json({ error: error.message });
    }
};

/**
 * Send video message via WhatsApp
 * 
 * Handles POST requests to send video messages:
 * - Validates required fields (recipient and video URL)
 * - Supports optional caption
 * - Sends video from publicly accessible URL
 * - Used for sharing video content and tutorials
 * 
 * @param {Object} request - Express request object
 * @param {Object} request.body - Request body
 * @param {string} request.body.to - Recipient's WhatsApp phone number
 * @param {string} request.body.videoUrl - URL of video to send
 * @param {string} [request.body.caption] - Optional caption text
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with result or error
 */
const sendVideo = async (request, response) => {
    // Extract video message parameters from request body
    const { to, videoUrl, caption } = request.body;
    
    try {
        // Validate required fields
        if (!to || !videoUrl) {
            return response.status(400).json({
                error: 'Bad Request',
                message: 'Both "to" and "videoUrl" fields are required'
            });
        }

        // Call service layer to send video message
        const result = await whatsappService.sendVideo(to, videoUrl, caption);
        
        // Return success response
        response.status(200).json({
            success: true,
            message: 'Video sent successfully',
            data: result
        });
    } catch (error) {
        // Return error response if sending fails
        response.status(500).json({ error: error.message });
    }
};

// Export controller functions for use in route handlers
module.exports = {
    sendTextMessage, // Handler for sending plain text messages
    sendTemplateMessage, // Handler for sending template messages
    sendImageMessage, // Handler for sending image messages
    sendInteractiveMessage, // Handler for sending interactive button messages (max 3 options)
    sendInteractiveListMessage, // Handler for sending interactive list messages (unlimited options)
    sendDocument, // Handler for sending document messages
    sendVideo // Handler for sending video messages
}