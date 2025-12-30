# AI Coding Agent Instructions for WhatsApp E-Learning Platform

## Project Overview
This is a **Node.js/Express backend** for a WhatsApp-based e-learning platform. It delivers educational content through WhatsApp Business API, manages courses/lessons/quizzes, tracks learner progress, and uses Redis-backed job queues for asynchronous message delivery.

**Stack**: Express.js, Prisma ORM (PostgreSQL), WhatsApp Business API, BullMQ (Redis), OpenRouter AI

---

## Architecture & Data Flow

### High-Level Request Flow
```
HTTP Request → Controller → Service Layer → Prisma (Database)
                                 ↓
                          External APIs (WhatsApp, OpenRouter)
                                 ↓
                          BullMQ Queue → Worker Process
```

### Key Data Flows
1. **Course Creation** (`/api/v1/courses`): Admin uploads course → Service creates course with lessons/quizzes → Schedule cron jobs for automated delivery
2. **Incoming Messages** (`POST /webhook`): WhatsApp webhook → `webhookService` parses message type → Stores in DB → Generates AI response → Queues for sending
3. **Quick Replies** (Button/Answer replies): User clicks button → `handleQuickReply()` looks up message context → Updates learner progress → Sends feedback
4. **Message Queue**: Service adds job → BullMQ queues → Worker process (`workerService.js`) → Sends via WhatsApp API

### Critical Service Boundaries
- **webhookService.js**: Message parsing, context tracking, webhook verification
- **courseService.js**: Course/lesson scheduling, progress tracking, cron job management
- **whatsappService.js**: All WhatsApp API communication (send-text, send-image, etc.)
- **queueService.js**: Job creation and queue management (text, lesson, reminder queues)
- **workerService.js**: Job processing (runs in background, respects rate limits)
- **aiService.js**: OpenRouter API calls for generating responses and quiz feedback

---

## Project-Specific Patterns

### 1. Prisma with Accelerate Extension
All services initialize Prisma identically:
```javascript
const { PrismaClient } = require('@prisma/client');
const { withAccelerate } = require('@prisma/extension-accelerate');
const prisma = new PrismaClient().$extends(withAccelerate());
```
**Why**: Accelerate improves query performance in serverless environments.

### 2. Queue-First Messaging Pattern
**Never call `sendTextMessage()` directly** except in webhookService. Use queue instead:
```javascript
// ✅ CORRECT - Add to queue, worker handles rate limiting
addJobToQueue(textQueue, "sendText", { phoneNumber: from, message: "Hi!" });

// ❌ WRONG - Blocks API and risks rate limiting
await sendTextMessage(from, "Hi!");
```
**Why**: Rate limiting (12 jobs/sec), retry logic, prevents timeouts.

### 3. Message Context Storage for Replies
When sending course content (lessons, quizzes), always store context:
```javascript
const messageId = /* from WhatsApp response */;
await storeMessageContext(phoneNumber, messageId, courseId, lessonId, quizId);
```
Later, when user replies, `handleQuickReply()` looks up context using message ID. **Without this, button replies fail**.

### 4. Error Handling Pattern
All services catch errors, log with context, and return user-friendly messages via queue:
```javascript
try {
  // database operations
} catch (error) {
  console.error('Operation failed:', error);
  addJobToQueue(textQueue, "sendText", { 
    phoneNumber: from, 
    message: "Üzgünüz, bir hata oluştu. Lütfen tekrar deneyin." 
  });
}
```
**Note**: Turkish messages throughout (not English) for learner audience.

### 5. Scheduling with Cron
Lesson delivery is scheduled with node-cron:
```javascript
cron.schedule('0 10 * * *', async () => {
  // Send lessons every day at 10:00 AM
}, { timezone: 'Europe/Istanbul' });
```
**Important**: Timezone is always Istanbul (Turkey). Don't hardcode UTC.

---

## Common Development Tasks

### Running the Server
```bash
npm run server        # Start with nodemon (development)
npm start             # Start production mode
```

### Database Operations
```bash
npm run prisma:generate   # Regenerate Prisma client
npm run prisma:migrate    # Apply pending migrations
npm run prisma:studio     # Open Prisma Studio GUI
```

### Adding a New API Endpoint
1. Create controller in `controllers/newController.js` (imports service)
2. Create service in `services/newService.js` (imports Prisma)
3. Create route in `routes/newRoute.js` (imports controller)
4. Register route in `server.js`: `app.use('/api/v1/new', newRoutes);`

### Testing Messages Locally
Use ngrok for webhook testing:
```javascript
// In server.js, uncomment ngrok setup to tunnel webhooks
require('@ngrok/ngrok'); // Provides public URL for WhatsApp webhook verification
```

---

## Critical File Locations & Patterns

| File/Dir | Purpose | Key Pattern |
|----------|---------|-------------|
| `webhookService.js` | Message parsing, reply context | Always store context with `storeMessageContext()` |
| `courseService.js` | Scheduling, progress tracking | Uses node-cron with Istanbul timezone |
| `whatsappService.js` | Direct WhatsApp API calls | Constructs payloads per WhatsApp API spec |
| `queueService.js` | Queue creation & dedup logic | Job IDs: `courseId-lessonId` for deduplication |
| `workerService.js` | Background job processing | Runs independently, respects rate limits |
| `aiService.js` | OpenRouter API integration | Fetches last 8 messages for context |
| `middleware/auth.js` | JWT verification | Bearer token in `Authorization` header |
| `prisma/schema.prisma` | Database schema | Includes cascade deletes, unique constraints |

---

## Message Type Routing (webhookService)

When incoming message arrives in `handleIncomingMessages()`:
- **`type: 'button'`**: User clicked quick reply → `handleQuickReply()`
- **`type: 'text'`**: User typed text → `generateAIResponse()` → queue message
- **`type: 'interactive'`**: User selected from list → `handleQuickReply()`
- **`type: 'image'`, `'document'`**: Store metadata, placeholder in DB
- **`type: 'video'`**: Not explicitly handled (log only)

---

## Database Schema Essentials

**Key Relations**:
- `Admin` → `Learner` (one-to-many, manages learners)
- `Admin` → `Course` (one-to-many)
- `Course` → `Lesson` (one-to-many, ordered by `day`)
- `Lesson` → `Quiz` (one-to-one)
- `Learner` → `Enrollment` (course enrollment)
- `Learner` → `CourseProgress` (tracks overall progress)
- `Learner` → `LessonProgress` (tracks individual lesson status)
- `Message` ← `MessageContext` (stores context for reply tracking)

**Important**: Cascade deletes set on GroupMember, GroupCourse, LessonProgress for data cleanup.

---

## Debugging Checklist

**Message Not Arriving?**
1. Check BullMQ worker is running: `workerService.js` running in background
2. Check Redis connection: `redis-connection.js` connects with correct credentials
3. Check rate limiting: BullMQ set to 12 jobs/sec max
4. Check message status in DB: `Message.status` should be "sent" → "delivered" → "read"

**Quick Reply Not Triggering?**
1. Verify `MessageContext` exists for original message ID
2. Check `handleQuickReply()` receives correct `context.id`
3. Verify button text matches expected values ("Başla", "Tamamdır", etc.)

**Course Not Scheduling?**
1. Check `scheduleLessons()` cron expression is valid
2. Verify timezone is "Europe/Istanbul"
3. Check cron job is not already running (memory leak risk)

---

## External Dependencies & Integration Points

- **WhatsApp Business API**: `whatsappService.js` constructs payloads per spec
- **OpenRouter API**: `aiService.js` calls with API key from `process.env.OPENROUTER_API_KEY`
- **PostgreSQL**: Prisma connection via `DATABASE_URL`
- **Redis**: BullMQ uses IORedis client (not `redis` client) for connection
- **Cloudinary**: Optional file uploads via `config/cloudinaryConfig.js`

---

## Notes for Long-Term Maintenance

1. **Message Context Expiry**: `messageContext` records expire after 7 days (`storeMessageContext()`)
2. **Queue Job Cleanup**: Completed/failed jobs auto-cleanup (configured in `queueService.js`)
3. **Learner Activation**: New learners default `active: false`, set true when clicking "Başla" button
4. **Timezone Hardcoding**: All scheduling assumes Istanbul timezone (UTC+3)
5. **No Test Suite**: No Jest/Mocha tests present; debug with console.logs and manual testing
