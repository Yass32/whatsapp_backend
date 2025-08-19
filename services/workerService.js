const { Worker } = require('bullmq');
const whatsappService = require('./whatsappService');
const { storeMessageContext } = require('./webhookService');
const connection = require('../redis-connection');

/**
 * Processes jobs for sending lessons.
 * Each job contains the data needed to send a lesson to a single user.
 */
const lessonProcessor = async (job) => {
  const { phoneNumber, frequency, lesson, course, currentLessonIndex } = job.data;
  console.log(`Processing lesson job ${job.id} for ${phoneNumber}`);
  try {
    await whatsappService.sendTextMessage(phoneNumber, `📚 ${frequency} Lesson ${currentLessonIndex + 1}: ${lesson.title}`);
    const response = await whatsappService.sendTemplateMessage(phoneNumber, 'new_lesson', 'en', { header: [lesson.title], body: [lesson.content] }, "Done");
    await storeMessageContext(phoneNumber, response.messageId, course.id, lesson.id);

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
 * Processes jobs for sending reminders.
 */
const reminderProcessor = async (job) => {
  const { phoneNumber, lesson, course, currentLessonIndex } = job.data;
  console.log(`Processing reminder job ${job.id} for ${phoneNumber}`);
  try {
    await whatsappService.sendTemplateMessage(phoneNumber, 'lesson_reminder', 'en', { header: [lesson.title], body: [course.name, `${currentLessonIndex + 1}`, '2 hours'] }, "Ready");
    console.log(`📨 Reminder sent to ${phoneNumber}`);
  } catch (error) {
    console.error(`❌ Failed to send reminder to ${phoneNumber}:`, error.message);
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
    const res = await whatsappService.sendTemplateMessage(to, 'new_courses', 'en', { header: [courseData.name], body: [courseData.description] }, "Start");
    await storeMessageContext(to, res.messageId, course.id);
    if (courseData.coverImage) await whatsappService.sendImageMessage(to, courseData.coverImage);
  } catch (notificationError) {
    console.error(`Failed to notify ${to}:`, notificationError.message);
    throw notificationError;
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

// Event listeners for logging
[lessonWorker, reminderWorker, notificationWorker].forEach(worker => {
  worker.on('completed', job => {
    console.log(`${worker.name} job ${job.id} has completed.`);
  });
  worker.on('failed', (job, err) => {
    console.log(`${worker.name} job ${job.id} has failed with ${err.message}`);
  });
});

console.log('Worker service started and listening for jobs...');

module.exports = {
    lessonWorker,
    reminderWorker,
    notificationWorker
}
