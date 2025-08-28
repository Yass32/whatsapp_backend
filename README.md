# WhatsApp E-Learning Backend

## Overview
This project is a backend API for a WhatsApp-based e-learning platform. It enables course creation, lesson scheduling, learner management, and automated WhatsApp messaging for educational content delivery. Built with Node.js, Express, and Prisma ORM, it supports admin and learner roles, JWT authentication, and integration with WhatsApp Business API.

---

## Features
- **RESTful API**: A complete API for managing courses, lessons, users, and learners.
- **Course Management**: Create courses with lessons, quizzes, and automated delivery schedules.
- **User Management**: Register, authenticate, and manage admin users and learners.
- **WhatsApp Messaging**: Send text, image, template, and interactive messages to learners.
- **Automated Lesson Scheduling**: Automate lesson delivery using cron jobs and queues.
- **Webhook Integration**: Handle WhatsApp webhook events for message status and replies.
- **Progress Tracking**: Track learner progress and quiz results.
- **Scheduled Cleanup**: A cron job for regular database maintenance and cleanup of old records.
- **Database Management** : Utilizes Prisma ORM for efficient and type-safe database interactions.
- **Background Job Processing**: Implements a message queue using BullMQ and Redis for handling asynchronous tasks like sending messages.
- **Security**: Uses helmet for setting security-related HTTP headers and cors for managing cross-origin requests.
- **Authentication** : Employs JWT-based authentication for securing API endpoints.

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

### Course Routes (`/courses`)
- `POST /create-course`: Create a new course with lessons, quizzes, and enrollments.
- `DELETE /all`: Delete all courses and related data.

### User Routes (`/users`)
- `POST /register`: Register a new admin user.
- `POST /login`: Authenticate admin user and issue JWT tokens.
- `POST /refresh-token`: Refresh access token using refresh token (cookie).
- `POST /logout`: Log out admin user.
- `GET /getusers`: Get all admin users.
- `GET /:id`: Get single admin user by ID.
- `PUT /:id`: Update admin user information.
- `DELETE /:id`: Delete admin user.
- `POST /create-learner`: Register one or more learners (bulk).
- `GET /get-all-learners`: Get all learners.
- `GET /get-learner/:id`: Get single learner by ID.
- `PUT /update-learner/:id`: Update learner information.
- `DELETE /delete-learner/:id`: Delete single learner.
- `DELETE /delete-all-learners`: Delete all learners and related data.

### WhatsApp Routes (`/whatsapp`)
- `POST /send-text`: Send plain text message.
- `POST /send-template`: Send template message.
- `POST /send-image`: Send image message.
- `POST /send-interactive`: Send interactive message with buttons.

### Webhook Routes (`/webhook`)
- `GET /webhook`: Verify WhatsApp webhook subscription.
- `GET /test`: Health check endpoint.
- `POST /webhook`: Handle incoming webhook events.
- `DELETE /all-messages`: Delete all messages and contexts.

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
- `JWT_SECRET`: Secret for access tokens
- `JWT_REFRESH_SECRET`: Secret for refresh tokens
- `DATABASE_URL`: Prisma database connection string
- `REDIS_URL`: Redis connection string
- `WHATSAPP_API_URL`: WhatsApp Business API endpoint
- `WHATSAPP_API_TOKEN`: WhatsApp API token

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