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

// Core dependencies
const express = require('express');
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

// Server configuration
const PORT = process.env.PORT || 3000;

// === MIDDLEWARE CONFIGURATION ===

/**
 * Security middleware
 * - helmet(): Sets various HTTP headers for security
 * - cors(): Enables Cross-Origin Resource Sharing
 */
app.use(helmet());

/**
 * CORS middleware
 * - cors(): Enables Cross-Origin Resource Sharing
 * - origin: Function to validate allowed origins
 * - methods: Array of allowed HTTP methods
 * - allowedHeaders: Array of allowed headers
 * - credentials: Boolean to allow credentials (e.g., cookies)
 */

app.use(cors()); // Allow all origins for development

/*
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      "https://myapp.zenolearn.io",
      "http://localhost:3000",
      "http://localhost:3001",
      "https://whatsapp-backend-s4dm.onrender.com",
      "https://arontechnology.com/",
      "https://arontechnology.com/zenolearn-demo"

    ];

    // Log the origin for debugging
    console.log('CORS check - Origin:', origin);

    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) {
      console.log('CORS: Allowing request with no origin');
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      console.log('CORS: Origin allowed:', origin);
      callback(null, true);
    } else {
      console.log('CORS: Origin rejected:', origin);
      console.log('CORS: Allowed origins:', allowedOrigins);
      callback(new Error('CORS policy violation'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "ngrok-skip-browser-warning",
    "Origin"
  ],
  credentials: true
}));
*/

/**
 * Body parser middleware
 * - express.json(): Parses incoming JSON requests
 */
app.use(express.json());


/**
 * Custom Request/Response Logging Middleware
 * Logs all incoming requests and outgoing responses with detailed information:
 * - Request: Method, URL, Headers, Query Params, Body
 * - Response: Status Code, Duration, Body
 */
app.use((req, res, next) => {
    const start = Date.now();
    const bodyLimit = 12000; // Character limit for body logging
    
    // Log incoming request details
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📥 INCOMING REQUEST`);
    console.log(`${'='.repeat(70)}`);
    console.log(`⏰ Time:        ${new Date().toISOString()}`);
    console.log(`🔹 Method:      ${req.method}`);
    console.log(`🔹 URL:         ${req.originalUrl}`);
    console.log(`🔹 IP:          ${req.ip || req.connection.remoteAddress}`);
    
    // Log headers (excluding sensitive ones)
    //const safeHeaders = { ...req.headers };
    //delete safeHeaders.authorization;
    //delete safeHeaders.cookie;
    const safeHeaders = { host: req.headers.host,'user-agent': req.headers['user-agent'], referer: req.headers.referer};
    console.log(`🔹 Headers:     ${JSON.stringify(safeHeaders, null, 2)}`);
    
    // Log query parameters if present
    if (Object.keys(req.query).length > 0) {
        console.log(`🔹 Query:       ${JSON.stringify(req.query, null, 2)}`);
    }
    
    // Log request body (for non-GET/HEAD requests)
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
        const bodyString = JSON.stringify(req.body, null, 2);
        const bodySnippet = bodyString.length > bodyLimit 
            ? bodyString.substring(0, bodyLimit) + '... [TRUNCATED]' 
            : bodyString;
        console.log(`🔹 Body:        ${bodySnippet}`);
    }
    
    // Capture response body
    let responseBody = null;
    const originalJson = res.json;
    const originalSend = res.send;

    // Override res.json to capture JSON responses
    res.json = function(body) {
        responseBody = body;
        return originalJson.apply(res, arguments);
    };

    // Override res.send to capture other responses
    res.send = function(body) {
        if (!responseBody) {
            if (typeof body === 'string') {
                try {
                    responseBody = JSON.parse(body);
                } catch (e) {
                    responseBody = body;
                }
            } else {
                responseBody = body;
            }
        }
        return originalSend.apply(res, arguments);
    };

    // Log response when finished
    res.on('finish', () => {
        const duration = Date.now() - start;
        
        console.log(`\n${'─'.repeat(70)}`);
        console.log(`📤 OUTGOING RESPONSE`);
        console.log(`${'─'.repeat(70)}`);
        console.log(`⏰ Time:        ${new Date().toISOString()}`);
        console.log(`🔹 Method:      ${req.method}`);
        console.log(`🔹 URL:         ${req.originalUrl}`);
        console.log(`🔹 Status:      ${res.statusCode} ${getStatusText(res.statusCode)}`);
        console.log(`🔹 Duration:    ${duration}ms`);
        
        // Log response body if present
        if (responseBody) {
            const bodyString = typeof responseBody === 'object' 
                ? JSON.stringify(responseBody, null, 2) 
                : String(responseBody);
            const bodySnippet = bodyString.length > bodyLimit 
                ? bodyString.substring(0, bodyLimit) + '... [TRUNCATED]' 
                : bodyString;
            console.log(`🔹 Body:        ${bodySnippet}`);
        }
        
        console.log(`${'='.repeat(70)}\n`);
    });

    next();
});

/**
 * Helper function to get HTTP status text
 */
function getStatusText(statusCode) {
    const statusTexts = {
        200: 'OK',
        201: 'Created',
        204: 'No Content',
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        409: 'Conflict',
        500: 'Internal Server Error',
        502: 'Bad Gateway',
        503: 'Service Unavailable'
    };
    return statusTexts[statusCode] || '';
}


/**
 * Static file serving middleware
 * - Serves uploaded files from uploads/ directory
 * - Serves test HTML page from public/ directory
 * - Files are saved to uploads/course_media/ so we serve from there
 */
//app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
//app.use('/uploads/course_media', express.static(path.join(__dirname, 'uploads/course_media'))); // Serves uploaded course media files

// Static file serving with proper Content-Type for videos
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".mp4")) {
      res.setHeader("Content-Type", "video/mp4");
    } else if (filePath.endsWith(".png")) {
      res.setHeader("Content-Type", "image/png");
    } else if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) {
      res.setHeader("Content-Type", "image/jpeg");
    } else if (filePath.endsWith(".pdf")) {
      res.setHeader("Content-Type", "application/pdf");
    }
  }
}));

app.use('/uploads/course_media', express.static(path.join(__dirname, 'uploads/course_media'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".mp4")) {
      res.setHeader("Content-Type", "video/mp4");
    } else if (filePath.endsWith(".png")) {
      res.setHeader("Content-Type", "image/png");
    } else if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) {
      res.setHeader("Content-Type", "image/jpeg");
    } else if (filePath.endsWith(".pdf")) {
      res.setHeader("Content-Type", "application/pdf");
    }
  }
}));

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