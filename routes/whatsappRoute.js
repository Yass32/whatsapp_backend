/**
 * WhatsApp Routes - API Endpoints for WhatsApp Message Sending
 * 
 * This module defines HTTP routes for sending various types of WhatsApp messages:
 * - Text messages for simple communication
 * - Template messages for structured, pre-approved content
 * - Image messages with optional captions
 * - Interactive messages for quizzes and user engagement
 */

const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');

/**
 * POST /whatsapp/send-text
 * Send plain text message
 * 
 * Sends simple text message to specified WhatsApp number.
 * Used for basic communication and notifications.
 * 
 * Required body parameters:
 * - to: Recipient's WhatsApp phone number
 * - message: Text message content
 */
router.post('/send-text', whatsappController.sendTextMessage);

/**
 * POST /whatsapp/send-template
 * Send template message
 * 
 * Sends pre-approved WhatsApp template message with optional parameters.
 * Templates must be approved by WhatsApp before use.
 * 
 * Required body parameters:
 * - to: Recipient's WhatsApp phone number
 * - templateName: Name of approved template
 * Optional parameters:
 * - languageCode: Template language code
 * - parameters: Array of parameter values for template
 */
router.post('/send-template', whatsappController.sendTemplateMessage);

/**
 * POST /whatsapp/send-image
 * Send image message
 * 
 * Sends image message from publicly accessible URL with optional caption.
 * Used for visual learning content and media sharing.
 * 
 * Required body parameters:
 * - to: Recipient's WhatsApp phone number
 * - imageUrl: URL of image to send
 * Optional parameters:
 * - caption: Text caption for the image
 */
router.post('/send-image', whatsappController.sendImageMessage);

/**
 * POST /whatsapp/send-interactive
 * Send interactive message with buttons
 * 
 * Sends interactive message with clickable buttons for user responses.
 * Used for quizzes, polls, and engaging user interactions.
 * 
 * Required body parameters:
 * - to: Recipient's WhatsApp phone number
 * - quizQuestion: Question or prompt text
 * Optional parameters:
 * - options: Array of button options for user selection
 */
router.post('/send-interactive', whatsappController.sendInteractiveMessage);

module.exports = router;
