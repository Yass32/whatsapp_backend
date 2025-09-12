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
 * POST /whatsapp/send-document
 * Send document message
 * 
 * Sends a document (PDF, DOC, etc.) to specified WhatsApp number.
 * Used for sharing course materials and documents.
 * 
 * Required body parameters:
 * - to: Recipient's WhatsApp phone number
 * - documentUrl: Publicly accessible URL of the document
 * 
 * Optional body parameters:
 * - filename: Custom filename for the document
 * - caption: Optional caption text for the document
 */
router.post('/send-document', whatsappController.sendDocument);

/**
 * POST /whatsapp/send-video
 * Send video message
 * 
 * Sends a video to specified WhatsApp number.
 * Used for sharing video tutorials and content.
 * 
 * Required body parameters:
 * - to: Recipient's WhatsApp phone number
 * - videoUrl: Publicly accessible URL of the video
 * 
 * Optional body parameters:
 * - caption: Optional caption text for the video
 */
router.post('/send-video', whatsappController.sendVideo);

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
 * 
 * Optional parameters:
 * - options: Array of button options (maximum 3) for user selection
 * 
 * Note: Limited to 3 buttons as per WhatsApp API restrictions
 */
router.post('/send-interactive', whatsappController.sendInteractiveMessage);

/**
 * POST /whatsapp/send-interactive-list
 * Send interactive list message
 * 
 * Sends an interactive list message with a dropdown of options.
 * Used when you have more than 3 options for user selection.
 * 
 * Required body parameters:
 * - to: Recipient's WhatsApp phone number
 * - quizQuestion: Question or prompt text
 * - options: Array of options (minimum 2) for the list
 * 
 * Example request body:
 * {
 *   "to": "1234567890",
 *   "quizQuestion": "Select your preferred course:",
 *   "options": ["Web Development", "Mobile App Development", "Data Science", "AI/ML"]
 * }
 */
router.post('/send-interactive-list', whatsappController.sendInteractiveListMessage);

module.exports = router;
