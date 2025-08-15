const cron = require('node-cron');
const cronParser = require('cron-parser');
const { PrismaClient } = require('../generated/prisma');
const { withAccelerate } = require('@prisma/extension-accelerate');
const { sendTextMessage, sendImageMessage, sendTemplateMessage, sendInteractiveMessage, sendInteractiveListMessage } = require('../services/whatsappService');
const { storeMessageContext } = require('../services/webhookService');

const prisma = new PrismaClient().$extends(withAccelerate());

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Schedule lessons to be sent at specific times with start date and frequency
 * @param {number} courseId - The course ID
 * @param {Array} numbers - Array of WhatsApp numbers to notify
 * @param {string} scheduleTime - Time in format "HH:MM" (24-hour format)
 * @param {string} startDate - Start date in format "YYYY-MM-DD" (optional, defaults to today)
 * @param {string} frequency - Frequency: "daily", "weekly", or "monthly" (defaults to "daily")
 * @param {string} timezone - Timezone (optional, defaults to Europe/Istanbul)
 */
const scheduleLessons = async (courseId, numbers, scheduleTime = "10:00", startDate = null, frequency = "daily", timezone = "Europe/Istanbul") => {
  try {
    // Get course with lessons and quizzes
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        lessons: {
          include: {
            quiz: true
          },
          orderBy: {
            day: 'asc'
          }
        }
      }
    });

    if (!course) {
      throw new Error('Course not found');
    }

    // Parse schedule time
    const [hour, minute] = scheduleTime.split(':').map(Number);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      throw new Error('Invalid time format. Use HH:MM in 24-hour format');
    }

    // Handle start date
    let schedulingStartDate = new Date();
    if (startDate) {
      schedulingStartDate = new Date(startDate);
      if (isNaN(schedulingStartDate.getTime())) {
        throw new Error('Invalid start date format. Use YYYY-MM-DD');
      }
    }

    // Validate frequency
    const validFrequencies = ['daily', 'weekly', 'monthly'];
    if (!validFrequencies.includes(frequency.toLowerCase())) {
      throw new Error('Invalid frequency. Use "daily", "weekly", or "monthly"');
    }

    // Create cron expression based on frequency
    let cronExpression;
    switch (frequency.toLowerCase()) {
      case 'daily':
        cronExpression = `${minute} ${hour} * * *`; // Every day at specified time
        break;
      case 'weekly':
        const dayOfWeek = schedulingStartDate.getDay(); // 0=Sunday, 1=Monday, etc.
        cronExpression = `${minute} ${hour} * * ${dayOfWeek}`; // Same day of week
        break;
      case 'monthly':
        const dayOfMonth = schedulingStartDate.getDate();
        cronExpression = `${minute} ${hour} ${dayOfMonth} * *`; // Same day of month
        break;
    }

    // Every 6 minutes for testing
    cronExpression = "*/6 * * * *";


    let currentLessonIndex = 0;
    const totalLessons = course.lessons.length;

    // Check if we should start scheduling now or wait for start date
    const now = new Date();
    const shouldStartNow = schedulingStartDate <= now;

    // Schedule the cron job
    const scheduledTask = cron.schedule(cronExpression, async () => {
      // Check if we've reached the start date
      const currentDate = new Date();
      if (currentDate < schedulingStartDate) {
        console.log(`⏳ Waiting for start date: ${schedulingStartDate.toDateString()}`);
        return;
      }

      if (currentLessonIndex >= totalLessons) {
        console.log(`✅ All lessons for course "${course.name}" have been sent. Stopping scheduler.`);
        scheduledTask.stop();
        return;
      }

      const lesson = course.lessons[currentLessonIndex];
      console.log(`Sending ${frequency} lesson ${currentLessonIndex + 1}/${totalLessons}: "${lesson.title}" at ${new Date().toLocaleString()}`);

      // Send lesson to all numbers
      for (const phoneNumber of numbers) {
        try {
          await sendTextMessage(phoneNumber, `📚 ${frequency} Lesson ${currentLessonIndex + 1}: ${lesson.title}`);
          await delay(3000);

          const response = await sendTemplateMessage(phoneNumber, 'new_lesson', 'en', { header: [lesson.title], body: [lesson.content] }, "Done");
          await storeMessageContext(phoneNumber, response.messageId, course.id, lesson.id);
          await delay(6000);
          
          if (lesson.quiz) {
            const response2 = await sendInteractiveListMessage(
              phoneNumber, 
              lesson.quiz.question, 
              lesson.quiz.options
            );
            await storeMessageContext(phoneNumber, response2.messageId, course.id, lesson.id, lesson.quiz.id);
          }
          
          console.log(`✅ Lesson sent to ${phoneNumber}`);
        } catch (error) {
          console.error(`❌ Failed to send lesson to ${phoneNumber}:`, error.message);
        }
      }

      currentLessonIndex++;
    }, {
      scheduled: true,
      timezone: timezone
    });

    // Compute next execution date correctly
    let nextExecution;
    try {
      const interval = cronParser.CronExpressionParser.parse(cronExpression, { currentDate: new Date(), tz: timezone });
      nextExecution = interval.next().toDate();
    } catch (err) {
      console.error("Failed to parse next cron execution:", err.message);
      nextExecution = schedulingStartDate;
    }

    console.log(`📅 Lessons scheduled for course "${course.name}" at ${scheduleTime} ${frequency} (${timezone})`);
    console.log(`📊 Total lessons to send: ${totalLessons}`);
    console.log(`🚀 Start date: ${schedulingStartDate.toDateString()}`);
    console.log(`⏰ Next lesson will be sent: ${nextExecution.toLocaleString()}`);

    return {
      success: true,
      message: `Scheduled ${totalLessons} lessons for ${frequency} delivery at ${scheduleTime}`,
      courseId: courseId,
      totalLessons: totalLessons,
      scheduleTime: scheduleTime,
      startDate: schedulingStartDate.toISOString().split('T')[0],
      frequency: frequency,
      timezone: timezone,
      nextExecution: nextExecution.toISOString()
    };

  } catch (error) {
    console.error('Error scheduling lessons:', error);
    throw new Error('Failed to schedule lessons: ' + error.message);
  }
};



/**
 * Create a course with nested lessons and enrollments in a single transaction.
 * @param {Object} courseData - { name, description, coverImage, adminId }
 * @param {Array} lessonsData - Array of lesson objects: { title, content, day, quiz }
 * @param {Array} numbers - Array of WhatsApp numbers to notify
 */
const createCourse = async (numbers, courseData, lessonsData, scheduleTime, startDate, frequency) => {
  try {
    const course = await prisma.course.create({
        data: {
            name: courseData.name,
            description: courseData.description,
            coverImage: courseData.coverImage ? courseData.coverImage : null,
            adminId: courseData.adminId,
            totalLessons: lessonsData.length,
            totalQuizzes: lessonsData.reduce((total, lesson) => total + (lesson.quiz ? 1 : 0), 0),
        },
    });

    // 2. Create all lessons and their quizzes
    const lessons = [];
    const quizzes = [];
    for (const lesson of lessonsData) {
        // Create the lesson
        const createdLesson = await prisma.lesson.create({
            data: {
                title: lesson.title,
                content: lesson.content,
                courseId: course.id,
                day: lesson.day
            }
        });
        lessons.push(createdLesson);

        // If quiz data is provided, create the quiz for this lesson
        if (lesson.quiz) {
            const createdQuiz = await prisma.quiz.create({
                data: {
                    lessonId: createdLesson.id,
                    question: lesson.quiz.question,
                    options: lesson.quiz.options, // should be an array
                    correctOption: lesson.quiz.correctOption
                }
            });
            quizzes.push(createdQuiz);
        }
    }

    // Create all enrollments
    const learnerId = await prisma.learner.findMany({
      where: { number: { in: numbers } }
    })
    const enrollments = await Promise.all(
        learnerId.map(learner =>
            prisma.enrollment.create({
                data: {
                  learnerId: learner.id,
                  courseId: course.id
                }
            })
        )
    );

    // Notify all numbers about the new course
    
    for (const to of numbers) {
      const res = await sendTemplateMessage(to, 'new_courses', 'en', { header: [courseData.name], body: [courseData.description] }, "Start");
      await storeMessageContext(to, res.messageId, course.id);
      await delay(5000);

      if (courseData.coverImage) await sendImageMessage(to, courseData.coverImage);
      await delay(3000);
    }

    // SCHEDULE FEATURE: Send lessons at specified times instead of immediately
    // This replaces the immediate lesson sending with scheduled delivery
    const scheduleLessonsResponse = await scheduleLessons(course.id, numbers, scheduleTime, startDate, frequency);

    return { scheduleLessonsResponse, course, lessons, quizzes, enrollments };
  } catch (error) {
    console.error('Failed to create course: ' + error.message);
    return { error: 'Failed to create course' };
  }
};

const updateCourseProgress = async (phoneNumber, courseId, lessonId, quizReply = null) => {
  let correct = null; // Initialize here

  // Find the learner
  const learner = await prisma.learner.findFirst({ where: { number: phoneNumber } });
  if (!learner) return { error: "Learner not found" };

  // Find the course with lesson and quiz counts
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { _count: { select: { lessons: true } } }
  });
  if (!course) return { error: "Course not found" };

  // Get or create progress
  let progress = await prisma.courseProgress.findUnique({
    where: { learnerId_courseId: { learnerId: learner.id, courseId } }
  });

  // If no progress exists, create it
  if (!progress) {
    progress = await prisma.courseProgress.create({
      data: { learnerId: learner.id, courseId }
    });
  }

  // Handle quiz reply (need lessonId from context)
  if (quizReply && lessonId) {
    const quiz = await prisma.quiz.findUnique({
      where: { lessonId: lessonId }
    });

    if (quiz) {
      if (quizReply === quiz.correctOption) {
        progress = await prisma.courseProgress.update({
          where: { id: progress.id },
          data: {
            quizScore: Math.round(
              ((progress.quizScore || 0) + (100 / course.totalQuizzes)) // Increment by percentage per quiz
            )
          }
        });
        correct = quiz.correctOption;
      }
    }
  } 
  // Handle lesson completion
  else if (!quizReply) {
    progress = await prisma.courseProgress.update({
      where: { id: progress.id },
      data: {
        completedLessons: { increment: 1 },
        progressPercent: Math.round(
          ((progress.completedLessons + 1) / course.totalLessons) * 100
        ),
        isCompleted: progress.completedLessons + 1 >= course.totalLessons,
        completedAt: progress.completedLessons + 1 >= course.totalLessons 
          ? new Date() 
          : null
      }
    });
  }

  return { progress, correct };
};

const deleteAllCourses = async () => {
  try {
    // Use a transaction to ensure all or nothing is deleted
    return await prisma.$transaction([
      prisma.messageContext.deleteMany({}),
      prisma.courseProgress.deleteMany({}),
      prisma.enrollment.deleteMany({}),
      prisma.lesson.deleteMany({}), // Lessons are tied to courses
      prisma.course.deleteMany({}),
    ]);
  } catch (error) {
    console.error("Failed to delete all courses and their dependencies:", error);
    throw error;
  }
};  

module.exports = {
  createCourse,
  updateCourseProgress,
  deleteAllCourses,
}

/*
{
  "courseData": {
    "name": "Introduction to Node.js",
    "description": "Learn the fundamentals of Node.js development",
    "coverImage": "https://ofy.org/wp-content/uploads/2015/11/OFY-learning-to-learn-cover-photo.jpg",
    "adminId": 1
  },
  "lessonsData": [
    {
      "title": "What is Node.js?",
      "content": "Node.js is a JavaScript runtime built on Chrome's V8 JavaScript engine...",
      "day": 1,
      "quiz": {
        "question": "What is Node.js?",
        "options": ["A programming language", "A JavaScript runtime", "A database", "A web browser"],
        "correctOption": "A JavaScript runtime"
      }
    },
    {
      "title": "Installing Node.js",
      "content": "To get started with Node.js, you need to install it on your system...",
      "day": 2,
      "quiz": {
        "question": "Which command installs Node.js globally?",
        "options": ["npm install node", "brew install node", "apt-get install nodejs", "All of the above"],
        "correctOption": "All of the above"
      }
    },
    {
      "title": "Your First Node.js App",
      "content": "Let's create a simple Hello World application...",
      "day": 3
      // No quiz for this lesson
    }
  ],
  "numbers": [
    "905359840140"
  ]
}
  */