/**
 * Webhook Controller - HTTP Request Handlers for WhatsApp Webhook Events
 * 
 * This controller handles WhatsApp Business API webhook operations:
 * - Webhook subscription verification
 * - Processing incoming message events
 * - Handling message status updates
 * - Message cleanup and management
 */

const webhookService = require('../services/webhookService');

/**
 * Verify WhatsApp webhook subscription
 * 
 * Handles GET requests from WhatsApp to verify webhook endpoint:
 * - Validates webhook verification token
 * - Returns challenge string if verification succeeds
 * - Required for initial webhook setup
 * 
 * @param {Object} request - Express request object
 * @param {Object} request.query - Query parameters from WhatsApp
 * @param {string} request.query['hub.verify_token'] - Verification token
 * @param {string} request.query['hub.challenge'] - Challenge string to return
 * @param {Object} response - Express response object
 * @returns {void} Sends challenge string or 403 error
 */
const verifyWebhook = async (request, response) => {
    try {
        // Call service layer to verify webhook parameters
        const challengeString = await webhookService.verifyWebhook(request);
        
        if (challengeString) {
            // Return challenge string to complete verification
            response.status(200).send(challengeString);
        } else {
            // Return 403 if verification fails
            response.sendStatus(403);
        }
    } catch (error) {
        // Return error response if verification process fails
        response.status(500).json({ error: error.message });
    }
}

/**
 * Handle incoming webhook events from WhatsApp
 * 
 * Processes POST requests containing WhatsApp webhook events:
 * - Message status updates (delivered, read, failed)
 * - Incoming messages from users
 * - Validates webhook payload structure
 * - Routes events to appropriate service handlers
 * 
 * @param {Object} request - Express request object
 * @param {Object} request.body - Webhook payload from WhatsApp
 * @param {Array} request.body.entry - Array of webhook entries
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with processing result
 */
const handleWebhook = async (request, response) => {
    try {
        // Extract webhook entries from request body
        const {entry} = request.body;

        // Validate webhook payload structure
        if(!entry || entry.length === 0) {
            return response.status(400).send('Invalid Request: No entry data');
        }

        // Extract changes from first entry
        const changes = entry[0].changes;

        if(!changes || changes.length === 0) {
            return response.status(400).send('Invalid Request: No changes data');
        }

        // Handle message status updates (delivery confirmations, read receipts)
        const statuses = changes[0].value.statuses ? changes[0].value.statuses[0] : null;
        if (statuses) { 
            // Process message status update
            const result = await webhookService.handleMessageStatuses(statuses);
            return response.status(200).json({
                success: true,
                message: 'Message status update processed successfully',
                data: result
            });
        }

        // Handle incoming messages from users
        const messages = changes[0].value.messages ? changes[0].value.messages[0] : null;
        if (messages) { 
            // Extract sender profile name
            const senderName = changes[0].value.contacts[0].profile.name;
            
            // Process incoming message
            const result = await webhookService.handleIncomingMessages(messages, senderName);
            return response.status(200).json({
                success: true,
                message: 'Incoming message processed successfully',
                data: result
            });
        }
        
        // If neither status nor message, return success (ignore other event types)
        return response.status(200).json({
            success: true,
            message: 'Webhook event received but not processed (unsupported type)'
        });
    } catch (error) {
        // Log error and return error response
        console.error('Webhook handling error:', error);
        response.status(500).json({ error: error.message });
    }
}

/**
 * Delete all messages and contexts from the system
 * 
 * Handles DELETE requests to remove all message-related data:
 * - Message records (incoming and outgoing)
 * - Message contexts (for reply tracking)
 * - Performs cascading deletion to maintain referential integrity
 * 
 * This is typically used for:
 * - System cleanup during development/testing
 * - Data reset operations
 * - Administrative maintenance
 * 
 * @param {Object} request - Express request object
 * @param {Object} response - Express response object
 * @returns {void} Sends JSON response with success message or error
 */
const deleteAllMessages = async (request, response) => {
    try {
        // Call service layer to perform cascading deletion
        await webhookService.deleteAllMessages();
        
        // Return success response
        response.status(200).json({ 
            message: 'All messages and contexts have been deleted successfully.' 
        });
    } catch (error) {
        // Return error response if deletion fails
        response.status(500).json({ error: error.message });
    }
};

// Export controller functions for use in route handlers
module.exports = {
    verifyWebhook, // Handler for WhatsApp webhook verification
    handleWebhook, // Handler for processing webhook events
    deleteAllMessages // Handler for deleting all messages and contexts
}