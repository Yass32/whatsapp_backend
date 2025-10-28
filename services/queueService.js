/**
 * Queue Service Module - Background Job Management
 * 
 * This module manages message queues using BullMQ and Redis for:
 * - Asynchronous message sending to avoid blocking API requests
 * - Rate limiting to comply with WhatsApp API restrictions
 * - Retry logic for failed message deliveries
 * - Job prioritization and scheduling
 * - Automatic cleanup of completed/failed jobs
 * 
 * Why use queues?
 * 1. Prevent API timeouts when sending to many recipients
 * 2. Respect WhatsApp rate limits (messages per second)
 * 3. Provide retry mechanism for failed deliveries
 * 4. Enable scheduled message delivery
 * 5. Track job status and failures
 * 
 * @module queueService
 * @requires bullmq - Redis-based queue library
 * @requires redis-connection - Shared Redis connection
 */

// Step 1: Import required dependencies
const { Queue } = require('bullmq'); // BullMQ queue library for job management
const connection = require('../redis-connection'); // Shared Redis connection instance

// Step 2: Define connection options for all queues
// These settings apply to all queues created in this module
const connectionOptions = {
  // Use the shared Redis connection
  connection,
  
  // Step 3: Configure rate limiting to prevent exceeding WhatsApp API limits
  // This ensures we don't send messages too quickly and get rate-limited
  limiter: { 
    max: Number(process.env.SEND_MAX_PER_SEC ?? 10), // Maximum jobs per duration (default: 10 per second)
    duration: 1000 // Duration in milliseconds (1000ms = 1 second)
  },
  
  // Step 4: Define default options for all jobs added to queues
  defaultJobOptions: {
    // Retry failed jobs up to 3 times before giving up
    attempts: 3,
    
    // Use exponential backoff for retries
    // First retry: 1 minute, Second retry: 2 minutes, Third retry: 4 minutes
    backoff: { 
      type: 'exponential', // Exponential backoff strategy
      delay: 60000 // Initial delay of 60 seconds (60000ms)
    },
    
    // Automatically remove old completed jobs to prevent memory bloat
    // Keep only the last 1000 completed jobs in Redis
    removeOnComplete: 1000,
    
    // Keep the last 5000 failed jobs for debugging and analysis
    removeOnFail: 5000,
  },
};

// Step 5: Create separate queues for different message types
// Each queue can be processed independently with different priorities

/**
 * Queue for sending lesson content to learners
 * Used when delivering course lessons on schedule
 */
const lessonQueue = new Queue('lessonSender', connectionOptions);

/**
 * Queue for sending reminder messages
 * Used to remind learners about upcoming lessons
 */
const reminderQueue = new Queue('reminderSender', connectionOptions);

/**
 * Queue for sending course notifications
 * Used when new courses are assigned to learners
 */
const notificationQueue = new Queue('notificationSender', connectionOptions);

/**
 * Queue for sending welcome messages
 * Used when new learners are registered
 */
const welcomeQueue = new Queue('welcomeSender', connectionOptions);

/**
 * Queue for sending text messages
 * Used to send normal text messages to learners
 */
const textQueue = new Queue('textSender', connectionOptions);


/**
 * Add a job to a specified queue with deduplication
 * 
 * This function adds jobs to queues while preventing duplicates.
 * Each job gets a unique ID based on its content to avoid sending
 * the same message multiple times.
 * 
 * Job ID generation logic:
 * - Welcome messages: name:phoneNumber
 * - Lesson messages: courseId:lessonId:phoneNumber
 * - Notification messages: courseId:phoneNumber
 * - Text messages: phoneNumber
 * 
 * @param {Queue} queue - The BullMQ queue to add the job to
 * @param {string} jobName - Descriptive name for the job (e.g., 'sendLesson')
 * @param {Object} data - Job data containing message details
 * @param {string} [data.name] - Learner name (for welcome messages)
 * @param {string} [data.to] - Recipient phone number
 * @param {string} [data.phoneNumber] - Alternative recipient phone number
 * @param {Object} [data.lesson] - Lesson object (for lesson messages)
 * @param {Object} [data.course] - Course object
 * @returns {Promise<void>} Resolves when job is added to queue
 * 
 * @example
 * // Add a lesson delivery job
 * await addJobToQueue(lessonQueue, 'sendLesson', {
 *   phoneNumber: '+1234567890',
 *   lesson: { id: 1, title: 'Introduction' },
 *   course: { id: 5, name: 'JavaScript Basics' }
 * });
 */
const addJobToQueue = async (queue, jobName, data) => {
  // Step 1: Generate a unique job ID to prevent duplicate jobs
  // This ensures we don't send the same message twice if the function is called multiple times
  const jobId = data.name && data.to 
    // For welcome messages: use name and recipient number
    ? `${data.name}:${data.to}` 
    // For lesson messages: use course ID, lesson ID, and phone number
    : data.lesson 
      ? `${data.course.id}:${data.lesson.id}:${data.phoneNumber || data.to}` 
      // For notification messages: use course ID and recipient number
      : `${data.course.id}:${data.to}`;

  // Step 2: Add the job to the queue with the unique ID
  // If a job with this ID already exists, it won't be added again
  await queue.add(jobName, data, {
    jobId: jobId, // Unique identifier for deduplication
  });
};

// Step 6: Export all queues and functions for use in other modules
module.exports = {
  lessonQueue, // Queue for lesson delivery jobs
  reminderQueue, // Queue for reminder jobs
  notificationQueue, // Queue for notification jobs
  welcomeQueue, // Queue for welcome message jobs
  textQueue, // Queue for text message jobs
  addJobToQueue, // Function to add jobs to any queue
};
