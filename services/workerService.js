const { Worker } = require('bullmq');
const whatsappService = require('./whatsappService');
const { storeMessageContext } = require('./webhookService');
const { lessonQueue, reminderQueue, notificationQueue, welcomeQueue, textQueue } = require('./queueService');
const { getRedisConnection } = require('../redis-connection'); // It is the lazy singleton Redis function

// Get one shared Redis connection for all workers
const connection = getRedisConnection(); // Shared Redis connection instance


/**
 * Processes jobs for sending welcome message notifications to new learners
 */
const welcomeProcessor = async (job) => {
  const { phoneNumber, name } = job.data;
  console.log(`Processing welcoming job ${job.id} for ${phoneNumber}`);
  try {
    // Send welcome message
    console.log(`Sending welcome message to ${phoneNumber}`);
    await whatsappService.sendTemplateMessage(phoneNumber, 'welcome_message', 'tr', { body: [name] });
  } catch (error) {
    console.error(`Failed to welcome ${phoneNumber}:`, error.message);
    throw error;
  }
};

/**
 * Processes jobs for sending new course notifications.
 */
const notificationProcessor = async (job) => {
  const { phoneNumber, courseData, course } = job.data;
  console.log(`Processing notification job ${job.id} for ${phoneNumber}`);
  try {
    // Send course notification
    const res = await whatsappService.sendTemplateMessage(phoneNumber, 'new_course', 'tr', { header: [courseData.name], body: [courseData.description] }, "Başla");
    await storeMessageContext(phoneNumber, res.messageId, course.id);
    if (courseData.coverImage) await whatsappService.sendImageMessage(phoneNumber, courseData.coverImage);
  } catch (notificationError) {
    console.error(`Failed to notify ${phoneNumber}:`, notificationError.message);
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
  try {
    // Send lesson content
    const response = await whatsappService.sendTemplateMessage(phoneNumber, 'new_lesson_tur', 'tr', { header: [lesson.title], body: [lesson.content] }, "Tamamdır");
    await storeMessageContext(phoneNumber, response.messageId, course.id, lesson.id);

    // Add a small delay to ensure proper message ordering
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Send document if available
    if (lesson.document) {
      let filename = lesson.document.split('/').pop().split('?')[0];
      console.log(filename);
      filename = filename.replace(/-\d{13}(\.\w+)$/, '$1');
      console.log(filename);
      await whatsappService.sendDocument(phoneNumber, lesson.document, filename);
    }

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
 * Processes jobs for sending text messages.
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
    await whatsappService.sendTextMessage(phoneNumber, message);
    console.log(`✅ Successfully sent text to ${phoneNumber}`);
  } catch (error) {
    console.error(`❌ Failed to send text to ${phoneNumber}:`, error.message);
    // Let BullMQ handle the retry based on queue configuration
    throw new Error("Text Processor error: " + error.message);
  }
};



// Create workers for each queue
const workerConnectionOptions = {
    connection,
    // Parallel workers
    concurrency: Number(process.env.SEND_CONCURRENCY ?? 5)
}

const lessonWorker = new Worker('lessonSender', lessonProcessor, workerConnectionOptions);
const reminderWorker = new Worker('reminderSender', reminderProcessor, workerConnectionOptions);
const notificationWorker = new Worker('notificationSender', notificationProcessor, workerConnectionOptions);
const welcomeWorker = new Worker('welcomeSender', welcomeProcessor, workerConnectionOptions);
const textWorker = new Worker('textSender', textProcessor, workerConnectionOptions);



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

console.log('Worker service started and listening for jobs...');

module.exports = {
    lessonWorker,
    reminderWorker,
    notificationWorker,
    welcomeWorker,
    textWorker,
}
