/**
 * Webhook Routes - API Endpoints for WhatsApp Webhook Integration
 * 
 * This module defines HTTP routes for WhatsApp Business API webhook operations:
 * - Webhook subscription verification (required by WhatsApp)
 * - Processing incoming webhook events (messages, status updates)
 * - Message cleanup and management
 * - Testing and health check endpoints
 */

const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

/**
 * GET /webhook
 * Verify WhatsApp webhook subscription
 * 
 * WhatsApp sends GET request to verify webhook endpoint during setup.
 * Must validate verification token and return challenge string.
 * Required for initial webhook configuration.
 */
router.get('/webhook', webhookController.verifyWebhook);

/**
 * GET /webhook/test
 * Health check endpoint
 * 
 * Simple test endpoint to verify webhook routes are accessible.
 * Used for debugging and monitoring webhook service availability.
 */
router.get('/test', (req, res) => res.send('Webhook route works!'));

/**
 * POST /webhook
 * Handle incoming webhook events
 * 
 * Processes webhook events from WhatsApp including:
 * - Incoming messages from users
 * - Message status updates (delivered, read, failed)
 * - Routes events to appropriate handlers
 */
router.post('/webhook', webhookController.handleWebhook);

/**
 * DELETE /webhook/all-messages
 * Delete all messages and contexts
 * 
 * Removes all message records and associated contexts from database.
 * Performs cascading deletion to maintain referential integrity.
 * Used for system cleanup and testing.
 */
router.delete('/all-messages', webhookController.deleteAllMessages);

module.exports = router;