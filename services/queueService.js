const { Queue } = require('bullmq');
const connection = require('../redis-connection');

// Define connection options for Redis. Using environment variables is recommended.
const connectionOptions = {
  connection,
  limiter: { max: Number(process.env.SEND_MAX_PER_SEC ?? 10), duration: 1000 }, // Global rate limit (tune to your WABA/number limits)
  defaultJobOptions: {
    attempts: 5, // retry each failed job up to 5 times
    backoff: { type: 'exponential', delay: 60000 },  // Wait 1 minute between retries
    removeOnComplete: 1000, // keep only the last 1000 completed jobs (older ones auto-removed).
    removeOnFail: 5000, // keep only the last 5000 failed jobs.
  },
};

// Create queues for different message types to handle them with different priorities if needed.
const lessonQueue = new Queue('lessonSender', connectionOptions);
const reminderQueue = new Queue('reminderSender', connectionOptions);
const notificationQueue = new Queue('notificationSender', connectionOptions);
const welcomeQueue = new Queue('welcomeSender', connectionOptions);

/**
 * Adds a job to the specified queue.
 * @param {Queue} queue - The queue to add the job to.
 * @param {string} jobName - The name of the job.
 * @param {object} data - The data for the job.
 */
const addJobToQueue = async (queue, jobName, data) => {
  // Generate a unique job ID to prevent duplicate jobs
  // This is based on the course ID, lesson ID (if applicable), and phone number or recipient ID
  const jobId = data.name && data.to ? `${data.name}:${data.to}` 
  : data.lesson ? `${data.course.id}:${data.lesson.id}:${data.phoneNumber || data.to}` 
  : `${data.course.id}:${data.to}`;

  await queue.add(jobName, data, {
    jobId: jobId,    
  });
};

module.exports = {
  lessonQueue,
  reminderQueue,
  notificationQueue,
  welcomeQueue,
  addJobToQueue,
};
