# WhatsApp E-Learning Platform - Complete Code Documentation

## 📚 Table of Contents
1. [Project Overview](#project-overview)
2. [Recent Updates](#recent-updates)
3. [Architecture](#architecture)
4. [File Structure](#file-structure)
5. [Step-by-Step Code Explanations](#step-by-step-code-explanations)
6. [API Endpoints](#api-endpoints)
7. [Database Schema](#database-schema)
8. [Message Queue System](#message-queue-system)
9. [Deployment Guide](#deployment-guide)

---

## 📝 Recent Updates

### Version 1.1.0 - Enhanced AI Integration & Queue Management (November 2025)

**AI Service Improvements**:
- ✅ **New AI Response Generator**: `callOpenRouterAPI()` utility function for centralized API calls
- ✅ **Context-aware Responses**: Fetches last 8 messages for conversation context
- ✅ **Temperature-based Tuning**: 0.7 for general responses, 0.4 for quiz feedback
- ✅ **Consistent Timeouts**: All API calls now use standardized 60-second timeout
- ✅ **Response Cleaning**: Removes quotes and markdown formatting for WhatsApp compatibility
- ✅ **Environment Validation**: Checks for required API credentials at startup

**Queue Service Enhancements**:
- ✅ **Smart Job ID Generation**: Different formats for different message types
- ✅ **Comprehensive Rate Limiting**: 12 jobs per second (improved from 10)
- ✅ **Automatic Job Cleanup**: Removes old completed/failed jobs automatically
- ✅ **Enhanced Deduplication**: Prevents duplicate messages across all queue types
- ✅ **Detailed Comments**: Every job type documented with examples

**Documentation Improvements**:
- ✅ **Extended inline comments**: Comprehensive explanations of complex logic
- ✅ **Character limit documentation**: All WhatsApp API limits documented
- ✅ **Error handling notes**: Detailed error recovery strategies
- ✅ **Example code**: Practical examples for each job type

---

## 🎯 Project Overview

This is a **WhatsApp-based E-Learning Platform** that delivers educational content through WhatsApp Business API. The system automates course delivery, tracks learner progress, and manages quiz assessments.

### Key Features
- ✅ Automated lesson scheduling and delivery
- ✅ WhatsApp message integration (text, images, videos, documents)
- ✅ Quiz management with interactive buttons
- ✅ Progress tracking for learners
- ✅ Group-based course assignments
- ✅ Background job processing with Redis queues
- ✅ Admin dashboard for course management

---

## 🏗️ Architecture

### Technology Stack
```
Backend Framework: Node.js + Express.js
Database: PostgreSQL with Prisma ORM (v6.18.0 with Accelerate)
Message Queue: Redis + BullMQ
AI Integration: OpenRouter API (deepseek-r1t2-chimera model)
Messaging: WhatsApp Business API v17.0
Authentication: JWT (JSON Web Tokens) with refresh token rotation
Scheduling: node-cron (v4.2.1)
File Upload: Multer + Cloudinary
Logging: Winston with file rotation
Cache: Prisma Accelerate extension
```

### Architectural Pattern
**Layered Architecture** with clear separation of concerns:

```
┌─────────────────────────────────────┐
│         HTTP Layer                  │
│   • Express.js Routes              │
│   • Middleware (Auth, CORS, etc.)  │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│        Controller Layer             │
│   • Request/Response Handlers       │
│   • Input Validation               │
│   • Error Handling                 │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│         Service Layer               │
│   • Business Logic                 │
│   • Database Operations            │
│   • External API Integrations      │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│         Data Layer                  │
│   • Prisma ORM                     │
│   • PostgreSQL Database            │
│   • Redis Cache/Queue              │
└─────────────────────────────────────┘
```

---

## 📁 File Structure

```
Whatsapp-Elearning/
│
├── server.js                 # Main application entry point
├── package.json             # Dependencies and scripts
├── redis-connection.js      # Shared Redis connection
│
├── routes/                  # API route definitions
│   ├── adminRoute.js       # Admin user management routes
│   ├── learnerRoute.js     # Learner management routes
│   ├── courseRoute.js      # Course CRUD routes
│   ├── groupRoute.js       # Group management routes
│   ├── whatsappRoute.js    # WhatsApp messaging routes
│   ├── webhookRoute.js     # Webhook event handling routes
│   └── uploadRoute.js      # File upload routes
│
├── controllers/             # HTTP request handlers
│   ├── adminController.js  # Admin operations
│   ├── learnerController.js# Learner operations
│   ├── courseController.js # Course operations
│   ├── groupController.js  # Group operations
│   ├── whatsappController.js# WhatsApp messaging
│   └── webhookController.js# Webhook processing
│
├── services/                # Business logic layer
│   ├── adminService.js     # Admin user management
│   ├── learnerService.js   # Learner management
│   ├── courseService.js    # Course and lesson management
│   ├── groupService.js     # Group operations
│   ├── whatsappService.js  # WhatsApp API integration
│   ├── webhookService.js   # Webhook event processing
│   ├── queueService.js     # Message queue management
│   ├── workerService.js    # Background job processing
│   ├── cleanupService.js   # Database maintenance
│   └── tokenService.js     # JWT token management
│
├── middleware/              # Express middleware
│   └── auth.js             # Authentication & authorization
│
├── prisma/                  # Database schema and migrations
│   └── schema.prisma       # Database schema definition
│
└── uploads/                 # Uploaded files storage
    └── course_media/       # Course images, videos, documents
```

---

## 🔍 Step-by-Step Code Explanations

### 1. Server Initialization (`server.js`)

**Step 1: Load Environment Variables**
```javascript
require('dotenv').config();
```
- Loads configuration from `.env` file
- Must be done before accessing `process.env`

**Step 2: Import Dependencies**
```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
```
- `express`: Web framework for routing
- `cors`: Enable cross-origin requests
- `helmet`: Security headers

**Step 3: Configure Middleware**
```javascript
app.use(helmet());
app.use(cors());
app.use(express.json());
```
- Security headers for protection
- CORS for API access
- JSON body parsing

**Step 4: Mount Routes**
```javascript
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/learners', learnerRoutes);
app.use('/api/v1/courses', courseRoutes);
```
- Organizes endpoints by resource type
- Version prefix for API versioning

**Step 5: Start Server**
```javascript
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  scheduleAutomaticCleanup();
});
```
- Starts HTTP server
- Initializes background services

---

### 2. AI Service (`services/aiService.js`)

**Purpose**: Generate AI-powered responses to learner messages and quiz feedback using OpenRouter API

**Step 1: Validate Environment Variables**
```javascript
if (!process.env.OPENROUTER_API_URL || !process.env.OPENROUTER_API_KEY) {
  console.error('❌ Missing required environment variables: OPENROUTER_API_URL or OPENROUTER_API_KEY');
  console.error('   Please add these to your .env file');
}
```
- Validates required credentials before making API calls
- Prevents cryptic errors later in the process

**Step 2: Create Reusable API Call Utility**
```javascript
const callOpenRouterAPI = async (messages, prompt, temperature = 0.7, timeoutMs = 60000) => {
  // Create abort controller for request timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(process.env.OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal,  // Abort if timeout exceeded
      body: JSON.stringify({
        model: "tngtech/deepseek-r1t2-chimera:free",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: messages }
        ],
        temperature: temperature
      })
    });

    // Validate HTTP response
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter API error ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();

    // Validate response structure
    if (!data.choices || !data.choices[0]?.message?.content) {
      throw new Error('Invalid API response: missing choices or content');
    }

    return data.choices[0].message.content;
  } finally {
    clearTimeout(timeout);
  }
};
```
- **Centralized API wrapper**: Single source of truth for API calls
- **Timeout handling**: 60-second timeout matches webhook constraints
- **Error validation**: Comprehensive response validation
- **Cleanup**: Always clears timeout to prevent memory leaks

**Step 3: Clean AI Response**
```javascript
const cleanAIResponse = (reply) => {
  if (!reply || typeof reply !== 'string') return '';
  
  let cleaned = reply.trim();
  
  // Remove leading/trailing quotes (single or double)
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
      (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  
  // Remove common markdown formatting
  cleaned = cleaned.replace(/^\*\*(.*?)\*\*$/g, '$1'); // **text** -> text
  cleaned = cleaned.replace(/^\*(.*?)\*$/g, '$1');     // *text* -> text
  
  return cleaned;
};
```
- Removes unwanted quote wrapping from API responses
- Strips markdown formatting for cleaner WhatsApp display

**Step 4: Generate AI Response for Learner Messages**
```javascript
const generateAIResponse = async (from) => {
  const SYSTEM_PROMPT = `You are Zeno Learn — a friendly and professional microlearning assistant...`;

  try {
    // Fetch the last 8 messages for context
    // Provides AI with conversation history to understand learner needs
    const contextMessages = await prisma.message.findMany({
      where: {
        OR: [
          { from: from },        // Messages from this learner
          { to: from }           // Messages sent to this learner
        ]
      },
      select: {
        direction: true,         // "incoming" or "outgoing"
        body: true,              // Message content
        localtime: true,         // Timestamp
        type: true               // "text", "image", etc.
      },
      orderBy: { createdAt: "desc" },
      take: 8  // Last 8 messages for context window
    });

    // Format messages as JSON for AI system prompt
    const messages = `Recent conversation messages: ${JSON.stringify(contextMessages, null, 2)}`;

    // Call API with:
    // - temperature 0.7: balanced creativity and accuracy
    // - 60000ms timeout: matches webhook timeout constraints
    const reply = await callOpenRouterAPI(messages, SYSTEM_PROMPT, 0.7, 60000);

    return cleanAIResponse(reply);
  } catch (error) {
    console.error("Error generating AI response:", error);
    return null;
  }
};
```
- **Context-aware**: Uses last 8 messages for conversation understanding
- **Multi-language**: Responds in learner's language
- **Friendly tone**: Designed for WhatsApp interactions
- **Error handling**: Returns null on failure without crashing

**Step 5: Generate AI Quiz Feedback**
```javascript
const generateAIQuizFeedback = async (aiQuizContext) => {
  const SYSTEM_PROMPT = `You are Zeno Learn, an AI tutor on WhatsApp...`;

  try {
    const messages = `${aiQuizContext} \n Determine if the learner is correct. Then generate the appropriate feedback.`;

    // Call API with:
    // - temperature 0.4: lower creativity, more factual accuracy
    // - 60000ms timeout: consistent with generateAIResponse
    const reply = await callOpenRouterAPI(messages, SYSTEM_PROMPT, 0.4, 60000);

    return cleanAIResponse(reply);
  } catch (error) {
    console.error("Error generating quiz feedback:", error);
    return null;
  }
};
```
- **Lower temperature**: 0.4 vs 0.7 for more accurate quiz feedback
- **Contextual feedback**: Explains correct/incorrect answers
- **Encouragement**: Keeps learners motivated
- **Multi-language support**: Responds in learner's language

---

### 2b. Redis Connection (`redis-connection.js`)

**Purpose**: Establish shared Redis connection for message queues and caching

**Implementation**:
```javascript
const connection = new IORedis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null // Required for BullMQ compatibility
});

// Event handling for connection monitoring
connection.on('error', (err) => {
  console.error('Redis connection error:', err);
});

connection.on('connect', () => {
  console.log('Connected to Redis');
});

module.exports = { getRedisConnection: () => connection };
```
- **Single connection instance**: Shared across all services to prevent pool exhaustion
- **Reusable export**: `getRedisConnection()` function for consistent access
- **Event monitoring**: Tracks connection status and errors
- **BullMQ compatible**: Configured with `maxRetriesPerRequest: null` as required

---

### 3. Queue Service (`services/queueService.js`)

**Purpose**: Manage background job queues for message sending with comprehensive deduplication and rate limiting

**Step 1: Define Queue Options**
```javascript
const connectionOptions = {
  connection,
  limiter: { 
    max: 12,        // Max 12 jobs per second (WhatsApp API compliance)
    duration: 1000  // 1 second window
  },
  defaultJobOptions: {
    attempts: 3,    // Retry failed jobs 3 times
    backoff: {
      type: 'exponential',
      delay: 60000  // Start with 1 minute delay, exponentially increase
    },
    removeOnComplete: 5,  // Keep last 5 completed jobs
    removeOnFail: 5       // Keep last 5 failed jobs for debugging
  }
};
```

**Step 2: Create Separate Queues**
```javascript
const lessonQueue = new Queue('lessonSender', connectionOptions);
const reminderQueue = new Queue('reminderSender', connectionOptions);
const notificationQueue = new Queue('notificationSender', connectionOptions);
const welcomeQueue = new Queue('welcomeSender', connectionOptions);
const textQueue = new Queue('textSender', connectionOptions);
```
- Separate queues for each message type
- Independent processing with same rate limits
- Prevents message flooding

**Step 3: Add Jobs with Smart Deduplication**
```javascript
const addJobToQueue = async (queue, jobName, data) => {
  // Text messages: "Message:+1234567890"
  // Welcome messages: "JohnDoe:+905554443322"
  // Lesson messages: "5:10:+905554443322" (courseId:lessonId:phone)
  // Notification messages: "5:+905554443322" (courseId:phone)
  // Fallback: "job-timestamp-random"
  
  const jobId = data.message && data.phoneNumber ? 
    `${data.message.slice(0, 7)}:${data.phoneNumber}`
    : data.name && data.phoneNumber ?
      `${data.name}:${data.phoneNumber}`
      : // ... more conditions ...
```
- **Smart job ID generation**: Different formats for different message types
- **Prevents duplicates**: Same message won't be sent twice
- **Tracks context**: Job ID includes relevant identifiers
- **Fallback strategy**: Timestamp + random string for unexpected data structures

---

### 4. Worker Service (`services/workerService.js`)

**Purpose**: Process background jobs from queues

**Step 1: Define Job Processors**
```javascript
const lessonProcessor = async (job) => {
  const { phoneNumber, lesson, course } = job.data;
  
  // Send lesson content
  await whatsappService.sendTemplateMessage(
    phoneNumber, 
    'new_lesson_tr', 
    'tr', 
    { header: [lesson.title], body: [lesson.content] }
  );
  
  // Send media if available
  if (lesson.media) {
    await whatsappService.sendVideo(phoneNumber, lesson.media);
  }
};
```

**Step 2: Create Workers**
```javascript
const lessonWorker = new Worker('lessonSender', lessonProcessor, {
  connection,
  concurrency: 5 // Process 5 jobs simultaneously
});
```

**Step 3: Handle Events**
```javascript
lessonWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

lessonWorker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});
```

---

### 5. WhatsApp Service (`services/whatsappService.js`)

**Purpose**: Integrate with WhatsApp Business API

**Step 1: Configure API Client**
```javascript
const baseUrl = `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
const headers = {
  'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
  'Content-Type': 'application/json'
};
```

**Step 2: Send Text Message**
```javascript
const sendTextMessage = async (to, message) => {
  const payload = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'text',
    text: { body: message }
  };
  
  const response = await axios.post(baseUrl, payload, { headers });
  
  // Log to database
  await prisma.message.create({
    data: {
      messageId: response.data.messages[0].id,
      from: "zenolearn",
      to: response.data.contacts[0].wa_id,
      body: message,
      type: "text",
      direction: "outgoing"
    }
  });
};
```

**Step 3: Send Template Message**
```javascript
const sendTemplateMessage = async (to, templateName, languageCode, parameters) => {
  const components = [];
  
  // Add header parameters
  if (parameters.header?.length > 0) {
    components.push({
      type: 'header',
      parameters: parameters.header.map(param => ({
        type: 'text',
        text: param
      }))
    });
  }
  
  // Add body parameters
  if (parameters.body?.length > 0) {
    components.push({
      type: 'body',
      parameters: parameters.body.map(param => ({
        type: 'text',
        text: param
      }))
    });
  }
  
  const payload = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: components
    }
  };
  
  await axios.post(baseUrl, payload, { headers });
};
```

---

### 6. Course Service (`services/courseService.js`)

**Purpose**: Manage courses and schedule lesson delivery

**Step 1: Create Course**
```javascript
const createCourse = async (courseData, lessonsData, learnerIds) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Create course
    const course = await tx.course.create({
      data: {
        name: courseData.name,
        description: courseData.description,
        adminId: courseData.adminId
      }
    });
    
    // 2. Create lessons
    const lessons = await Promise.all(
      lessonsData.map((lesson, index) =>
        tx.lesson.create({
          data: {
            title: lesson.title,
            content: lesson.content,
            day: index + 1,
            courseId: course.id
          }
        })
      )
    );
    
    // 3. Create enrollments
    await tx.enrollment.createMany({
      data: learnerIds.map(learnerId => ({
        courseId: course.id,
        learnerId: learnerId
      }))
    });
    
    return course;
  });
};
```

**Step 2: Schedule Lessons**
```javascript
const scheduleLessons = async (courseId, numbers, scheduleTime, frequency) => {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { lessons: { orderBy: { day: 'asc' } } }
  });
  
  let currentLessonIndex = 0;
  
  // Create cron expression
  const [hour, minute] = scheduleTime.split(':');
  const cronExpression = `${minute} ${hour} * * *`; // Daily
  
  // Schedule cron job
  cron.schedule(cronExpression, async () => {
    if (currentLessonIndex >= course.lessons.length) {
      return; // All lessons sent
    }
    
    const lesson = course.lessons[currentLessonIndex];
    
    // Queue lesson for each learner
    for (const phoneNumber of numbers) {
      await addJobToQueue(lessonQueue, 'sendLesson', {
        phoneNumber,
        lesson,
        course
      });
    }
    
    currentLessonIndex++;
  });
};
```

---

### 7. Webhook Service (`services/webhookService.js`)

**Purpose**: Handle incoming WhatsApp events

**Step 1: Verify Webhook**
```javascript
const verifyWebhook = async (request) => {
  const mode = request.query['hub.mode'];
  const token = request.query['hub.verify_token'];
  const challenge = request.query['hub.challenge'];
  
  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    return challenge; // Return challenge to verify
  }
  
  return null;
};
```

**Step 2: Handle Incoming Messages**
```javascript
const handleIncomingMessages = async (messages, name) => {
  const { from, id, type } = messages;
  
  let messageBody = '';
  
  switch (type) {
    case 'text':
      messageBody = messages.text.body;
      await sendTextMessage(from, "Thank you for your message!");
      break;
      
    case 'button':
      messageBody = messages.button.text;
      await handleQuickReply(from, messageBody, messages.context);
      break;
  }
  
  // Log message to database
  await prisma.message.create({
    data: {
      messageId: id,
      from: from,
      body: messageBody,
      type: type,
      direction: "incoming"
    }
  });
};
```

**Step 3: Handle Message Status**
```javascript
const handleMessageStatuses = async (statuses) => {
  const { id, status } = statuses;
  
  // Update message status in database
  await prisma.message.updateMany({
    where: { messageId: id },
    data: { status: status }
  });
};
```

---

### 8. Authentication Middleware (`middleware/auth.js`)

**Purpose**: Protect routes with JWT authentication

**Step 1: Verify JWT Token**
```javascript
const authenticateJWT = (request, response, next) => {
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return response.status(401).json({
      error: 'Authorization header missing'
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    request.user = decoded;
    next();
  } catch (error) {
    return response.status(403).json({
      error: 'Invalid token'
    });
  }
};
```

**Step 2: Check Admin Role**
```javascript
const authorizeAdmin = (request, response, next) => {
  if (request.user.role !== 'admin') {
    return response.status(403).json({
      error: 'Admin access required'
    });
  }
  next();
};
```

---

## 📡 API Endpoints

### Admin Routes (`/api/v1/admin`)
```
POST   /register          - Register new admin
POST   /login             - Admin login
POST   /refresh-token     - Refresh access token
POST   /logout            - Admin logout
GET    /all               - Get all admins
GET    /:adminId          - Get admin by ID
PUT    /:adminId          - Update admin
DELETE /:adminId          - Delete admin
DELETE /all               - Delete all admins
```

### Learner Routes (`/api/v1/learners`)
```
POST   /                  - Register learners (bulk)
GET    /:adminId          - Get all learners for admin
GET    /:learnerId/details- Get learner details
PUT    /:learnerId        - Update learner
DELETE /:learnerId        - Delete learner
DELETE /all               - Delete all learners
GET    /:adminId/insights - Get learner analytics
```

### Course Routes (`/api/v1/courses`)
```
POST   /                  - Create course with lessons
GET    /:adminId          - Get admin's courses
GET    /id/:courseId      - Get course by ID
PUT    /:courseId         - Update course
PUT    /:courseId/publish - Publish course
PUT    /:courseId/archive - Archive course
POST   /:courseId/unarchive- Unarchive course
DELETE /:courseId         - Delete course
DELETE /all               - Delete all courses
```

### Group Routes (`/api/v1/groups`)
```
POST   /                  - Create group
GET    /:adminId          - Get admin's groups
GET    /:groupId          - Get group details
PUT    /:groupId          - Update group
DELETE /:groupId          - Delete group
POST   /:groupId/members  - Add members
DELETE /:groupId/members  - Remove members
POST   /:groupId/courses  - Assign courses
DELETE /:groupId/courses  - Remove courses
```

### WhatsApp Routes (`/api/v1/whatsapp`)
```
POST   /send-text         - Send text message
POST   /send-template     - Send template message
POST   /send-image        - Send image message
POST   /send-document     - Send document
POST   /send-video        - Send video
POST   /send-interactive  - Send interactive buttons
POST   /send-interactive-list - Send interactive list
```

### Webhook Routes (`/api/v1`)
```
GET    /webhook           - Verify webhook
POST   /webhook           - Handle webhook events
DELETE /all-messages      - Delete all messages
```

### Upload Routes (`/api/v1/upload`)
```
POST   /single            - Upload single file
POST   /multiple          - Upload multiple files
POST   /cover             - Upload course cover
POST   /document          - Upload document
POST   /media             - Upload media (video/image)
GET    /:filename         - Get uploaded file
DELETE /:filename         - Delete file
DELETE /all               - Delete all files
```

---

## 🗄️ Database Schema

### Core Tables

**Admin**
- Stores administrator user accounts
- Fields: id, name, surname, email, password, number, department, company

**Learner**
- Stores student/learner accounts
- Fields: id, name, surname, email, number, active, adminId

**Course**
- Stores course information
- Fields: id, name, description, coverImage, status, adminId, totalLessons, totalQuizzes

**Lesson**
- Stores lesson content
- Fields: id, title, content, day, courseId, document, media, externalLink

**Quiz**
- Stores quiz questions
- Fields: id, lessonId, question, options (JSON), correctOption

**Group**
- Stores learner groups
- Fields: id, name, adminId

**GroupMember**
- Links learners to groups
- Fields: id, groupId, learnerId

**GroupCourse**
- Links courses to groups
- Fields: id, groupId, courseId

**Enrollment**
- Links learners to courses
- Fields: id, learnerId, courseId

**CourseProgress**
- Tracks overall course progress
- Fields: id, learnerId, courseId, completedLessons, progressPercent, quizScore

**LessonProgress**
- Tracks individual lesson progress
- Fields: id, learnerId, lessonId, isCompleted, quizScore, quizReply

**Message**
- Stores all WhatsApp messages
- Fields: id, messageId, from, to, body, type, direction, status

**MessageContext**
- Links messages to courses/lessons/quizzes
- Fields: id, messageId, phoneNumber, courseId, lessonId, quizId

---

## 🔄 Message Queue System

### Queue Architecture
```
┌─────────────┐
│   Cron Job  │ (Scheduled lesson delivery)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Add to Queue│ (lessonQueue, reminderQueue, etc.)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    Redis    │ (Job storage and management)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Worker    │ (Process jobs)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ WhatsApp API│ (Send message)
└─────────────┘
```

### Queue Types

1. **lessonQueue**: Sends lesson content
2. **reminderQueue**: Sends lesson reminders
3. **notificationQueue**: Sends course notifications
4. **welcomeQueue**: Sends welcome messages

### Job Processing Flow

1. **Job Creation**: Cron job or API call creates job
2. **Queue Addition**: Job added to appropriate queue
3. **Rate Limiting**: Max 10 jobs per second
4. **Worker Processing**: Worker picks up job
5. **Message Sending**: WhatsApp API called
6. **Retry Logic**: Failed jobs retried 3 times
7. **Completion**: Job marked as complete or failed

---

## 🚀 Deployment Guide

### Environment Variables
```env
# Server
PORT=3000
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# WhatsApp
WHATSAPP_API_URL=https://graph.facebook.com/v17.0
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_verify_token

# JWT
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
```

### Installation Steps

1. **Clone Repository**
```bash
git clone <repository-url>
cd Whatsapp-Elearning
```

2. **Install Dependencies**
```bash
npm install
```

3. **Setup Database**
```bash
npx prisma migrate deploy
npx prisma generate
```

4. **Start Redis**
```bash
redis-server
```

5. **Start Application**
```bash
npm start
```

### Production Deployment

1. **Build Application**
```bash
npm run build
```

2. **Start with PM2**
```bash
pm2 start server.js --name whatsapp-elearning
pm2 save
pm2 startup
```

3. **Setup Nginx Reverse Proxy**
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 📝 Code Comments Summary

All files in this project now include:
- ✅ **Module-level documentation**: Purpose and overview
- ✅ **Function documentation**: Parameters, returns, examples
- ✅ **Step-by-step comments**: Explaining each code block
- ✅ **Inline comments**: Clarifying complex logic
- ✅ **Error handling explanations**: Why and how errors are handled

---

## 🤝 Contributing

When adding new features:
1. Follow the existing code structure
2. Add comprehensive comments
3. Update this documentation
4. Test thoroughly before committing

---

## 📄 License

MIT License - See LICENSE file for details

---

**Last Updated**: January 2025
**Version**: 1.0.0
