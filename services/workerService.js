const { Worker } = require('bullmq');
const whatsappService = require('./whatsappService');
const { storeMessageContext } = require('./webhookService');
const connection = require('../redis-connection');
const { lessonQueue, reminderQueue, notificationQueue, welcomeQueue, textQueue } = require('./queueService');


/**
 * Processes jobs for sending welcome message notifications to new learners
 */
const welcomeProcessor = async (job) => {
  const { to, name } = job.data;
  console.log(`Processing welcoming job ${job.id} for ${to}`);
  try {
    // Send welcome message
    console.log(`Sending welcome message to ${to}`);
    await whatsappService.sendTemplateMessage(to, 'welcome_message', 'tr', { body: [name] });
  } catch (error) {
    console.error(`Failed to welcome ${to}:`, error.message);
    throw error;
  }
};

/**
 * Processes jobs for sending new course notifications.
 */
const notificationProcessor = async (job) => {
  const { to, courseData, course } = job.data;
  console.log(`Processing notification job ${job.id} for ${to}`);
  try {
    // Send course notification
    const res = await whatsappService.sendTemplateMessage(to, 'new_course', 'tr', { header: [courseData.name], body: [courseData.description] }, "Başla");
    await storeMessageContext(to, res.messageId, course.id);
    if (courseData.coverImage) await whatsappService.sendImageMessage(to, courseData.coverImage);
  } catch (notificationError) {
    console.error(`Failed to notify ${to}:`, notificationError.message);
    throw notificationError;
  }
};

/**
 * Processes jobs for sending reminders.
 */
const reminderProcessor = async (job) => {
  const { phoneNumber, lesson, course, currentLessonIndex } = job.data;
  console.log(`Processing reminder job ${job.id} for ${phoneNumber}`);
  try {
    // Send reminder message
    await whatsappService.sendTemplateMessage(phoneNumber, 'lesson_reminder', 'tr', { header: [lesson.title], body: [course.name, `${currentLessonIndex + 1}`, '2 saat'] }, "Hazır");
    console.log(`📨 Reminder sent to ${phoneNumber}`);
  } catch (error) {
    console.error(`❌ Failed to send reminder to ${phoneNumber}:`, error.message);
    throw error;
  }
};


/**
 * Processes jobs for sending lessons.
 * Each job contains the data needed to send a lesson to a single user.
 */
const lessonProcessor = async (job) => {
  const { phoneNumber, frequency, lesson, course, currentLessonIndex } = job.data;
  console.log(`Processing lesson job ${job.id} for ${phoneNumber}`);
  try {
    // Send lesson content
    const response = await whatsappService.sendTemplateMessage(phoneNumber, 'new_lesson_tr', 'tr', { header: [lesson.title], body: [lesson.content] }, "Tamamdır");
    await storeMessageContext(phoneNumber, response.messageId, course.id, lesson.id);

    // Add a small delay to ensure proper message ordering
    await new Promise(resolve => setTimeout(resolve, 60000));

    // Send document if available
    if (lesson.document) await whatsappService.sendDocument(phoneNumber, lesson.document);

    // Send media if available
    if (lesson.media) {
      if (lesson.media.endsWith('.mp4')) {  
        await whatsappService.sendVideo(phoneNumber, lesson.media);
      } else {
        await whatsappService.sendImageMessage(phoneNumber, lesson.media);
      }
    }

    // Send external link if available
    if (lesson.externalLink) await whatsappService.sendTextMessage(phoneNumber, lesson.externalLink);

    // Send quiz if available
    if (lesson.quiz) {
      const response2 = await whatsappService.sendInteractiveListMessage(phoneNumber, lesson.quiz.question, lesson.quiz.options);
      await storeMessageContext(phoneNumber, response2.messageId, course.id, lesson.id, lesson.quiz.id);
    }
    console.log(`✅ Lesson sent to ${phoneNumber}`);
  } catch (error) {
    console.error(`❌ Failed to send lesson to ${phoneNumber}:`, error.message);
    throw error; // Throw error to let BullMQ handle retry
  }
};


/**
 * Processes jobs for sending text messages with retry and cleanup logic.
 * Each job contains the data needed to send a text message to a single user.
 * 
 * @param {Object} job - The BullMQ job object
 * @param {Object} job.data - The job data
 * @param {string} job.data.phoneNumber - Recipient's phone number
 * @param {string} job.data.message - The message text to send
 * @returns {Promise<void>}
 */
const textProcessor = async (job) => {
  const { phoneNumber, message } = job.data;

  try {
    console.log(`📨 Processing text job ${job.id} for ${phoneNumber}`);
    await whatsappService.sendTextMessage(phoneNumber, message);
    console.log(`✅ Successfully sent text to ${phoneNumber}`);
  } catch (error) {
    console.error(`❌ Failed to send text to ${phoneNumber}:`, error.message);
    // Let BullMQ handle the retry based on queue configuration
    throw new Error("Text Processor error: " + error.message);
  }
};

/**
 * Cleans up old completed/failed jobs from the queue
 * @param {Queue} queue - The BullMQ queue to clean
 * @param {number} maxAgeHours - Maximum age of jobs to keep (in hours)
 * @returns {Promise<{completed: number, failed: number}>} Count of removed jobs
 */
const cleanupOldJobs = async (queue, maxAgeHours = 24) => {
  try {
    const currentTime = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    let removedCount = { completed: 0, failed: 0 };

    // Clean up old completed jobs
    const completedJobs = await queue.getJobs(['completed'], 0, 100);
    for (const job of completedJobs) {
      if (job.finishedOn && currentTime - job.finishedOn > maxAgeMs) {
        await job.remove();
        removedCount.completed++;
      }
    }

    // Clean up old failed jobs
    const failedJobs = await queue.getJobs(['failed'], 0, 100);
    for (const job of failedJobs) {
      if (job.finishedOn && currentTime - job.finishedOn > maxAgeMs) {
        await job.remove();
        removedCount.failed++;
      }
    }

    if (removedCount.completed > 0 || removedCount.failed > 0) {
      console.log(`🧹 Cleaned up ${removedCount.completed} completed and ${removedCount.failed} failed jobs from ${queue.name} older than ${maxAgeHours} hours`);
    }
    return removedCount;
  } catch (error) {
    console.error(`Error cleaning up old jobs from ${queue.name}:`, error);
    throw error;
  }
};



// Create workers for each queue

const workerConnectionOptions = {
    connection,
    // Parallel workers
    concurrency: Number(process.env.SEND_CONCURRENCY ?? 10)
}

const lessonWorker = new Worker('lessonSender', lessonProcessor, workerConnectionOptions);
const reminderWorker = new Worker('reminderSender', reminderProcessor, workerConnectionOptions);
const notificationWorker = new Worker('notificationSender', notificationProcessor, workerConnectionOptions);
const welcomeWorker = new Worker('welcomeSender', welcomeProcessor, workerConnectionOptions);
const textWorker = new Worker('textSender', textProcessor, workerConnectionOptions);


// Schedule cleanup of old jobs every 6 hours
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const cleanupInterval = setInterval(async () => {
  try {
    console.log('🧹 Running scheduled queue cleanup...');
    const queues = [lessonQueue, reminderQueue, notificationQueue, welcomeQueue, textQueue];
    for (const queue of queues) {
      await cleanupOldJobs(queue, 24); // Clean jobs older than 24 hours
    }
  } catch (error) {
    console.error('Error during scheduled cleanup:', error);
  }
}, CLEANUP_INTERVAL_MS);

// Handle graceful shutdown
const cleanup = async () => {
  console.log('🛑 Shutting down workers...');
  clearInterval(cleanupInterval);
  
  await Promise.all([
    lessonWorker.close(),
    reminderWorker.close(),
    notificationWorker.close(),
    welcomeWorker.close(),
    textWorker.close()
  ]);
  
  console.log('✅ All workers stopped');
};

// Event listeners for logging
[lessonWorker, reminderWorker, notificationWorker, welcomeWorker, textWorker].forEach(worker => {
  worker.on('completed', (job) => {
    console.log(`✅ ${worker.name} job ${job.id} completed successfully`);
  });
  
  worker.on('failed', (job, err) => {
    const jobInfo = job ? `job ${job.id}` : 'unknown job';
    console.error(`❌ ${worker.name} ${jobInfo} failed after ${job?.attemptsMade || 0} attempts: ${err.message}`);
  });
  
  worker.on('error', (error) => {
    console.error(`🚨 ${worker.name} worker encountered an error:`, error);
  });
  
  worker.on('stalled', (jobId) => {
    console.warn(`⚠️ ${worker.name} job ${jobId} stalled and will be reprocessed`);
  });
});

// Handle process termination
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

console.log('Worker service started and listening for jobs...');

module.exports = {
    lessonWorker,
    reminderWorker,
    notificationWorker,
    welcomeWorker,
    textWorker,
    cleanupOldJobs,
    cleanup
}
