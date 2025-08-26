const { Worker } = require('bullmq');
const whatsappService = require('./whatsappService');
const { storeMessageContext } = require('./webhookService');
const connection = require('../redis-connection');


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
    const res = await whatsappService.sendTemplateMessage(to, 'new_courses', 'tr', { header: [courseData.name], body: [courseData.description] }, "Başla");
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
    // Send lesson title
    // await whatsappService.sendTextMessage(phoneNumber, `📚 ${frequency} Lesson ${currentLessonIndex + 1}: ${lesson.title}`);
    // Send lesson content
    const response = await whatsappService.sendTemplateMessage(phoneNumber, 'new_lesson', 'tr', { header: [lesson.title], body: [lesson.content] }, "Tamamdır");
    await storeMessageContext(phoneNumber, response.messageId, course.id, lesson.id);

    // Add a small delay to ensure proper message ordering
    await new Promise(resolve => setTimeout(resolve, 6000));

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

// Event listeners for logging
[lessonWorker, reminderWorker, notificationWorker, welcomeWorker].forEach(worker => {
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
    notificationWorker,
    welcomeWorker
}
