# WhatsApp E-Learning Backend

## Overview
This project is a comprehensive backend API for a WhatsApp-based e-learning platform. It enables course creation, lesson scheduling, learner management, and automated WhatsApp messaging for educational content delivery. Built with Node.js, Express.js, and Prisma ORM, it supports admin and learner roles, JWT authentication, and seamless integration with WhatsApp Business API.

## Features
- **RESTful API**: Complete API for managing courses, lessons, users, and learners
- **Course Management**: Create courses with lessons, quizzes, and automated delivery schedules
- **User Management**: Register, authenticate, and manage admin users and learners
- **WhatsApp Messaging**: Send text, image, template, and interactive messages to learners
- **Automated Lesson Scheduling**: Automate lesson delivery using cron jobs and Redis-backed queues
- **Webhook Integration**: Handle WhatsApp webhook events for message status and replies
- **Progress Tracking**: Track learner progress and quiz results with detailed analytics
- **Scheduled Cleanup**: Automated database maintenance and cleanup of old records
- **Database Management**: Utilizes Prisma ORM for efficient and type-safe database interactions
- **Background Job Processing**: Implements message queue using BullMQ and Redis for asynchronous tasks
- **Security**: Uses Helmet for security headers and CORS for cross-origin requests
- **Authentication**: JWT-based authentication with access and refresh tokens
- **File Upload**: Support for course media (images, videos, documents) with Multer

## Documentation
For detailed code explanations, architecture overview, and step-by-step guides, see [DOCUMENTATION.md](./DOCUMENTATION.md)

---

## Folder Structure
```
controllers/         # Express route handlers for business logic
services/            # Service layer for DB and external integrations
routes/              # API route definitions
middleware/          # Auth and other middleware
prisma/              # Prisma schema and migrations
redis-connection.js  # Redis setup for queues
server.js            # Express app entry point
```

---

## API Endpoints

### Admin Routes (`/api/v1/admin`)
- `POST /register`: Register a new admin user
- `POST /login`: Authenticate admin user and issue JWT tokens
- `POST /refresh-token`: Refresh access token using refresh token (cookie)
- `POST /logout`: Log out admin user
- `GET /all`: Get all admin users
- `GET /:adminId`: Get single admin user by ID
- `PUT /:adminId`: Update admin user information
- `DELETE /:adminId`: Delete admin user
- `DELETE /all`: Delete all admins and related data

### Learner Routes (`/api/v1/learners`)
- `POST /`: Register one or more learners (bulk)
- `GET /:adminId`: Get all learners for an admin
- `GET /:learnerId/details`: Get single learner by ID
- `PUT /:learnerId`: Update learner information
- `DELETE /:learnerId`: Delete single learner
- `DELETE /all`: Delete all learners and related data
- `GET /:adminId/insights`: Get comprehensive learner analytics

### Course Routes (`/api/v1/courses`)
- `POST /`: Create a new course with lessons, quizzes, and enrollments
- `GET /:adminId`: Get all courses for an admin
- `GET /id/:courseId`: Get single course by ID with lessons and quizzes
- `PUT /:courseId`: Update course information
- `PUT /:courseId/publish`: Publish a course
- `PUT /:courseId/archive`: Archive a course
- `POST /:courseId/unarchive`: Unarchive a course (create new copy)
- `DELETE /:courseId`: Delete a specific course
- `DELETE /all`: Delete all courses and related data

### Group Routes (`/api/v1/groups`)
- `POST /`: Create a new group
- `GET /:adminId`: Get all groups for an admin
- `GET /:groupId`: Get group details with members and courses
- `PUT /:groupId`: Update group information
- `DELETE /:groupId`: Delete a group
- `POST /:groupId/members`: Add members to a group
- `DELETE /:groupId/members`: Remove members from a group
- `POST /:groupId/courses`: Assign courses to a group
- `DELETE /:groupId/courses`: Remove courses from a group

### WhatsApp Routes (`/api/v1/whatsapp`)
- `POST /send-text`: Send plain text message
- `POST /send-template`: Send template message
- `POST /send-image`: Send image message
- `POST /send-document`: Send document message
- `POST /send-video`: Send video message
- `POST /send-interactive`: Send interactive message with buttons
- `POST /send-interactive-list`: Send interactive list message

### Webhook Routes (`/api/v1`)
- `GET /webhook`: Verify WhatsApp webhook subscription
- `POST /webhook`: Handle incoming webhook events
- `DELETE /all-messages`: Delete all messages and contexts

### Upload Routes (`/api/v1/upload`)
- `POST /single`: Upload a single file
- `POST /multiple`: Upload multiple files
- `POST /cover`: Upload course cover image
- `POST /document`: Upload document
- `POST /media`: Upload media (video/image)
- `GET /:filename`: Serve uploaded file
- `DELETE /:filename`: Delete specific file
- `DELETE /all`: Delete all files

---

## Data Models

### Admin User
- `id`, `name`, `surname`, `email`, `password` (hashed), `number`, `department`, `company`

### Learner
- `id`, `name`, `surname`, `email`, `number`, `department`, `company`

### Course
- `id`, `name`, `description`, `coverImage`, `adminId`, `totalLessons`, `totalQuizzes`

### Lesson
- `id`, `title`, `content`, `day`, `courseId`

### Quiz
- `id`, `question`, `answers`, `lessonId`

### Enrollment
- `id`, `learnerId`, `courseId`

---

## Request/Response Examples

### Create Course
**Request:**
```json
{
  "numbers": ["+1234567890"],
  "courseData": {
    "name": "Intro to AI",
    "description": "Learn AI basics.",
    "coverImage": "https://example.com/image.png",
    "adminId": 1
  },
  "lessonsData": [
    {
      "title": "Lesson 1",
      "content": "What is AI?",
      "day": 1,
      "quiz": {
        "question": "What does AI stand for?",
        "answers": ["Artificial Intelligence"]
      }
    }
  ],
  "scheduleTime": "10:00",
  "startDate": "2025-08-21",
  "frequency": "daily"
}
```
**Response:**
```json
{
  "id": 101,
  "name": "Intro to AI",
  "lessons": [ ... ],
  "quizzes": [ ... ],
  "enrollments": [ ... ],
  "schedule": { ... }
}
```

### Register Admin User
**Request:**
```json
{
  "name": "Admin",
  "surname": "User",
  "password": "securePassword123",
  "email": "admin1@example.com",
  "number": "+1234567890",
  "department": "it",
  "company": "TechCorp"
}
```
**Response:**
```json
{
  "id": 1,
  "name": "Admin",
  "surname": "User",
  "email": "admin1@example.com",
  "number": "+1234567890",
  "department": "it",
  "company": "TechCorp"
}
```

### Register Learner (Bulk)
**Request:**
```json
{
  "learners": [
    {
      "name": "John",
      "surname": "Doe",
      "email": "john.doe@example.com",
      "number": "+1234567890",
      "department": "learning",
      "company": "TechCorp"
    }
  ]
}
```
**Response:**
```json
{
  "count": 1
}
```

---

## Authentication
- JWT-based authentication for admin users.
- Access tokens (short-lived) and refresh tokens (long-lived, stored in HTTP-only cookies).
- Middleware for protected routes (see `middleware/auth.js`).

---

## Scheduling & Queues
- Uses `node-cron` for lesson scheduling.
- Redis-backed queues for message delivery and notifications.
- Automated reminders and lesson delivery to WhatsApp numbers.

---

## Webhook Integration
- Handles WhatsApp webhook events for incoming messages and status updates.
- Verifies webhook subscription during WhatsApp setup.
- Stores message context for replies and tracking.

---

## Setup & Installation
1. **Clone the repository**
   ```sh
   git clone <repo-url>
   cd Whatsapp-Elearning
   ```
2. **Install dependencies**
   ```sh
   npm install
   ```
3. **Configure environment variables**
   - Create a `.env` file with required secrets (see below).
4. **Setup Prisma**
   ```sh
   npx prisma migrate deploy
   npx prisma generate
   ```
5. **Start the server**
   ```sh
   npm start
   ```

---

## Environment Variables
- `JWT_SECRET`: Secret for signing access tokens
- `JWT_REFRESH_SECRET`: Secret for signing refresh tokens
- `DATABASE_URL`: PostgreSQL connection string for Prisma
- `REDIS_HOST`: Redis server hostname
- `REDIS_PORT`: Redis server port
- `REDIS_USERNAME`: Redis username (for Redis 6.0+)
- `REDIS_PASSWORD`: Redis password
- `WHATSAPP_API_URL`: WhatsApp Business API base URL (e.g., https://graph.facebook.com/v17.0)
- `WHATSAPP_PHONE_NUMBER_ID`: WhatsApp Business phone number ID
- `WHATSAPP_ACCESS_TOKEN`: WhatsApp API access token
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`: Token for webhook verification

## API Base URL
All API endpoints are prefixed with: `https://whatsapp-backend-s4dm.onrender.com/api/v1`

---

## Technologies Used
- Node.js
- Express.js
- Prisma ORM
- Redis
- JWT
- node-cron
- WhatsApp Business API

---

## Contributing
Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

---

## License
MIT