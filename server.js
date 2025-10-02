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
const morgan = require('morgan'); // Import the request logger
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
 * to the console (stdout), which Render captures.
 */
app.use(morgan('combined')); // Request logging enabled

/**
 * Body parser middleware
 * - express.json(): Parses incoming JSON requests
 */
app.use(express.json());

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
  /*
    const BASE_URL = process.env.NODE_ENV === 'production'
        ? (process.env.BASE_URL || `http://localhost:${PORT}`)
        : `http://localhost:${PORT}`;

        */

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

    // Optional database connection test (async and won't crash server)
    try {
        if (testConnection) {
            await testConnection();
            console.log('✅ Database connection verified');
        }
    } catch (error) {
        console.warn('⚠️ Database connection test failed:', error.message);
        console.log('💡 Server will continue without database connection');
    }

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