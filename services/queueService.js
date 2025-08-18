const { Queue } = require('bullmq');

// Define connection options for Redis. Using environment variables is recommended.
const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
};

// Create queues for different message types to handle them with different priorities if needed.
const lessonQueue = new Queue('lessonSender', { connection });
const reminderQueue = new Queue('reminderSender', { connection });
const notificationQueue = new Queue('notificationSender', { connection });

/**
 * Adds a job to the specified queue.
 * @param {Queue} queue - The queue to add the job to.
 * @param {string} jobName - The name of the job.
 * @param {object} data - The data for the job.
 */
const addJobToQueue = async (queue, jobName, data) => {
  await queue.add(jobName, data, {
    jobId: `${course.id}:${lesson.id}:${phone}`, // Unique job ID
    attempts: 5, // Retry a failed job up to 5 times
    backoff: { type: 'exponential', delay: 1000 }, // Use exponential backoff for retries
    removeOnComplete: 1000, // Remove job from queue when completed
    removeOnFail: 5000, // Remove job from queue after 5 retries
    
  });
};

module.exports = {
  lessonQueue,
  reminderQueue,
  notificationQueue,
  addJobToQueue,
};
