/**
 * WhatsApp E-learning Platform Server
 * * Main application server that orchestrates the WhatsApp-based learning platform.
 * * Key Features:
 * - RESTful API for course and user management
 * - WhatsApp Business API integration for messaging
 * - Webhook handling for real-time message processing
 * - Automated lesson delivery scheduling
 * - Database cleanup and maintenance
 * - Development tunnel via ngrok
 * * Architecture:
 * - Express.js web framework
 * - Prisma ORM with database
 * - WhatsApp Business API integration
 * - JWT-based authentication
 * - Automated cron job scheduling
 * - New Relic APM integration
 */

// Load environment variables from .env file
require('dotenv').config();

// === NEW RELIC INTEGRATION (MUST BE THE FIRST REQUIRE) ===
// NOTE: You must install 'newrelic' via npm, and the 'newrelic.js' file must exist in the root.
const newrelic = require('newrelic'); 

// Core dependencies
const express = require('express');
// Removed: const morgan = require('morgan'); // Keeping user preference to avoid morgan
//const axios = require('axios'); // HTTP client (imported but not directly used)
const cors = require('cors'); // Cross-Origin Resource Sharing
const helmet = require('helmet'); // Security middleware
const path = require('path'); // For file path operations
const app = express();

// Route imports
const adminRoutes = require('./routes/adminRoute');
const learnerRoutes = require('./routes/learnerRoute');
const whatsappRoutes = require('./routes/whatsappRoute');
const webhookRoutes = require('./routes/webhookRoute');
const courseRoutes = require('./routes/courseRoute');
const groupRoutes = require('./routes/groupRoute');
const uploadRoutes = require('./routes/uploadRoute');

// Service imports
const { scheduleAutomaticCleanup } = require('./services/cleanupService');
//const ngrok = require('@ngrok/ngrok'); // Development tunnel for webhook testing
require('./services/workerService.js'); // Initialize and start the message queue worker

// Optional database connection test (won't crash server if it fails)
try {
  const testConnection = require('./test-db.js');
  // Test will run but won't crash server if it fails
} catch (error) {
  console.warn('⚠️ Database connection test file not found or has errors');
} 

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
 * Request Logging Middleware
 * - morgan('combined'): Logs the incoming request details (Method, URL, Status, Response Time)
 * 
 * to the console (stdout), which Render captures.
 */
//app.use(morgan('tiny')); // Request logging enabled

/**
 * Body parser middleware
 * - express.json(): Parses incoming JSON requests
 */
app.use(express.json());


/**
 * Custom Request/Response Attribute Middleware
 * This middleware captures request and response bodies, timing, and status,
 * logging essential transaction markers to the console and adding body snippets 
 * as custom attributes to the New Relic transaction trace for deep debugging.
 */
app.use((req, res, next) => {
    const start = Date.now();
    // New Relic custom attribute strings have a 4KB limit, so we keep the 500 character limit.
    const bodyLimit = 500; 
    
    // Log start of incoming request for local console visibility
    console.log(`\n======================================================`);
    console.log(`[REQ START] ${req.method} ${req.originalUrl}`);
    
    // Process and attribute the request body (only for non-GET/HEAD requests)
    if (req.method !== 'GET' && req.method !== 'HEAD' && Object.keys(req.body).length > 0) {
        const bodyString = JSON.stringify(req.body, null, 2);
        const bodySnippet = bodyString.substring(0, bodyLimit) + (bodyString.length > bodyLimit ? '...' : '');

        // Add to New Relic custom attribute
        newrelic.addCustomAttribute('request.body_snippet', bodySnippet);
    }

    // --- Monkey-Patching Response to Capture Body ---
    let responseBody = {};
    const originalJson = res.json;
    const originalSend = res.send;

    // Capture response data when res.json is called
    res.json = function(body) {
        responseBody = body; // Capture the JSON object
        return originalJson.apply(res, arguments); // Call the original method to send
    };

    // Capture response data when res.send is called
    res.send = function(body) {
        if (typeof body === 'string' || typeof body === 'object') {
            try {
                // Try to parse if it's a stringified JSON (common in express)
                responseBody = JSON.parse(body); 
            } catch (e) {
                // Otherwise, capture the raw body
                responseBody = body;
            }
        }
        return originalSend.apply(res, arguments); // Call the original method to send
    };

    // Listen for the 'finish' event on the response object to log final details
    res.on('finish', () => {
        const duration = Date.now() - start;
        
        // Log the final status and time
        console.log(`[REQ DONE] ${req.method} ${req.originalUrl} | Status: ${res.statusCode} | Time: ${duration}ms`);

        // Attribute the response body to New Relic
        const bodyString = JSON.stringify(responseBody, null, 2);
        const bodySnippet = bodyString.substring(0, bodyLimit) + (bodyString.length > bodyLimit ? '...' : '');

        newrelic.addCustomAttribute('response.body_snippet', bodySnippet);
        
        console.log(`======================================================\n`);
    });

    next();
});


/**
 * Static file serving middleware
 * - Serves uploaded files from uploads/ directory
 * - Serves test HTML page from public/ directory
 * - Files are saved to uploads/course_media/ so we serve from there
 */
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads/course_media', express.static(path.join(__dirname, 'uploads/course_media'))); // Serves uploaded course media files

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
 * Admin management routes (/api/v1/admin/*)
 * Handles admin authentication and CRUD operations
 */
app.use('/api/v1/admin', adminRoutes);

/**
 * Learner management routes (/api/v1/learners/*)
 * Handles learner registration and management
 */
app.use('/api/v1/learners', learnerRoutes);

/**
 * Course management routes (/api/v1/courses/*)
 * Handles course creation, deletion, and management
 */
app.use('/api/v1/courses', courseRoutes);

/**
 * Group management routes (/api/v1/groups/*)
 * Handles group creation, member management, and course assignments
 */
app.use('/api/v1/groups', groupRoutes);

/**
 * File upload routes (/api/v1/upload/*)
 * Handles file uploads, serving, and management
 */
app.use('/api/v1/upload', uploadRoutes);




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
const server = app.listen(PORT, async () => {
    console.log(`🚀 WhatsApp E-learning Server is running on port ${PORT}`);
    console.log(`📚 API Base URL: https://whatsapp-backend-s4dm.onrender.com/api/v1`);

    // === INITIALIZE SERVICES ===

    /**
     * Start automatic cleanup scheduler
     * Runs weekly cleanup of expired message contexts and old messages
     */

    console.log('👷 Initializing message queue worker...');
    // The worker is started by requiring the file, no further action needed here.

    console.log('📅 Initializing automatic cleanup scheduler...');
    scheduleAutomaticCleanup();

    console.log('🔄 Testing database connection...');
    //testConnection();

    console.log('\n🎯 Server initialization complete!');
    console.log('📖 Ready to process WhatsApp e-learning requests');
});


// === GLOBAL ERROR HANDLERS ===

// Graceful shutdown for unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  if (server) {
    server.close(() => {
      process.exit(1); // Exit with failure code
    });
  } else {
    process.exit(1);
  }
});

// Graceful shutdown for uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  if (server) {
    server.close(() => {
      process.exit(1); // Immediately exit, as state is unclean
    });
  } else {
    process.exit(1);
  }
});