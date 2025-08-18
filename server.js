/**
 * WhatsApp E-learning Platform Server
 * 
 * Main application server that orchestrates the WhatsApp-based learning platform.
 * 
 * Key Features:
 * - RESTful API for course and user management
 * - WhatsApp Business API integration for messaging
 * - Webhook handling for real-time message processing
 * - Automated lesson delivery scheduling
 * - Database cleanup and maintenance
 * - Development tunnel via ngrok
 * 
 * Architecture:
 * - Express.js web framework
 * - Prisma ORM with database
 * - WhatsApp Business API integration
 * - JWT-based authentication
 * - Automated cron job scheduling
 */

// Load environment variables from .env file
require('dotenv').config();

// Core dependencies
const express = require('express');
const axios = require('axios'); // HTTP client (imported but not directly used)
const cors = require('cors'); // Cross-Origin Resource Sharing
const helmet = require('helmet'); // Security middleware
const app = express();

// Route imports
const userRoutes = require('./routes/userRoute');
const whatsappRoutes = require('./routes/whatsappRoute');
const webhookRoutes = require('./routes/webhookRoute');
const courseRoute = require('./routes/courseRoute');

// Service imports
const { scheduleAutomaticCleanup } = require('./services/cleanupService');
const ngrok = require('@ngrok/ngrok'); // Development tunnel for webhook testing
require('./services/workerService.js'); // Initialize and start the message queue worker

// Server configuration
const PORT = process.env.PORT || 3000;

// === MIDDLEWARE CONFIGURATION ===

/**
 * Security middleware
 * - helmet(): Sets various HTTP headers for security
 * - cors(): Enables Cross-Origin Resource Sharing
 */
app.use(helmet());
app.use(cors());

/**
 * Body parser middleware
 * - express.json(): Parses incoming JSON requests
 */
app.use(express.json());

// === API ROUTES ===

/**
 * Webhook routes (/api/v1/webhook, /api/v1/test, etc.)
 * Handles WhatsApp webhook verification and event processing
 */
app.use('/api/v1', webhookRoutes);

/**
 * WhatsApp messaging routes (/api/v1/whatsapp/*)
 * Handles sending various types of WhatsApp messages
 */
app.use('/api/v1/whatsapp', whatsappRoutes);

/**
 * User and learner management routes (/api/v1/users/*)
 * Handles authentication, user CRUD, and learner management
 */
app.use('/api/v1/users', userRoutes);

/**
 * Course management routes (/api/v1/courses/*)
 * Handles course creation, deletion, and management
 */
app.use('/api/v1/courses', courseRoute);




// === SERVER STARTUP ===

/**
 * Start the Express server and initialize services
 * 
 * Startup sequence:
 * 1. Start HTTP server on specified port
 * 2. Initialize automatic database cleanup scheduler
 * 3. Establish ngrok tunnel for webhook development
 * 4. Log startup information and tunnel URL
 */
app.listen(PORT, async () => {
    console.log(`🚀 WhatsApp E-learning Server is running on port ${PORT}`);
    console.log(`📚 API Base URL: http://localhost:${PORT}/api/v1`);
    
    // === INITIALIZE SERVICES ===
    
    /**
     * Start automatic cleanup scheduler
     * Runs weekly cleanup of expired message contexts and old messages
     */
    console.log('👷 Initializing message queue worker...');
    // The worker is started by requiring the file, no further action needed here.

    console.log('📅 Initializing automatic cleanup scheduler...');
    scheduleAutomaticCleanup();
    
    // === DEVELOPMENT TUNNEL SETUP ===
    
    /**
     * Initialize ngrok tunnel for webhook development
     * 
     * ngrok provides a public URL that forwards to localhost,
     * enabling WhatsApp to send webhook events to the local server.
     * 
     * Configuration:
     * - addr: Local server port
     * - authtoken: ngrok authentication token from environment
     * - domain: Reserved static domain for consistent webhook URL
     */
    try {
        console.log('🌐 Starting ngrok tunnel for webhook development...');
        
        const listener = await ngrok.connect({
            addr: PORT, // Forward to local server port
            authtoken: process.env.NGROK_AUTHTOKEN, // Auth token from .env file
            domain: 'climbing-cosmic-pegasus.ngrok-free.app' // Reserved static domain
        });
        
        console.log(`✅ ngrok tunnel established: ${listener}`);
        console.log(`🔗 Webhook URL: ${listener}/api/v1/webhook`);
        console.log('📱 Configure this URL in WhatsApp Business API webhook settings');
        
    } catch (error) {
        // Log ngrok errors but don't crash the server
        console.error('❌ Error starting ngrok tunnel:', error.message);
        if (error.response?.data) {
            console.error('📄 ngrok error details:', error.response.data);
        }
        console.log('⚠️  Server will continue without ngrok tunnel');
        console.log('💡 For webhook testing, manually configure a public URL');
    }
    
    console.log('\n🎯 Server initialization complete!');
    console.log('📖 Ready to process WhatsApp e-learning requests');
});