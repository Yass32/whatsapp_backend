const { PrismaClient } = require('../generated/prisma');
const { withAccelerate } = require('@prisma/extension-accelerate'); 
const bcrypt = require('bcrypt');
const jwt = require("jsonwebtoken");
const cron = require('node-cron');
const {sendTextMessage, sendImageMessage, sendTemplateMessage, sendInteractiveMessage} = require('../services/whatsappService')

const prisma = new PrismaClient().$extends(withAccelerate());

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Schedule lessons to be sent at specific times
 * @param {number} courseId - The course ID
 * @param {Array} numbers - Array of WhatsApp numbers to notify
 * @param {string} scheduleTime - Time in format "HH:MM" (24-hour format)
 * @param {string} timezone - Timezone (optional, defaults to system timezone)
 */
const scheduleLessons = async (courseId, numbers, scheduleTime = "08:00", timezone = "Africa/Cairo") => {
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

    // Create cron expression for daily execution at specified time
    const cronExpression = `${minute} ${hour} * * *`;

    let currentLessonIndex = 0;
    const totalLessons = course.lessons.length;

    // Schedule the cron job
    const scheduledTask = cron.schedule(cronExpression, async () => {
      if (currentLessonIndex >= totalLessons) {
        console.log(`All lessons for course "${course.name}" have been sent. Stopping scheduler.`);
        scheduledTask.stop();
        return;
      }

      const lesson = course.lessons[currentLessonIndex];
      console.log(`Sending lesson ${currentLessonIndex + 1}/${totalLessons}: "${lesson.title}" at ${new Date().toLocaleString()}`);

      // Send lesson to all numbers
      for (const phoneNumber of numbers) {
        try {
          await sendTextMessage(phoneNumber, `📚 Daily Lesson ${currentLessonIndex + 1}: ${lesson.title}`);
          
          if (lesson.quiz) {
            await sendInteractiveMessage(
              phoneNumber, 
              lesson.title, 
              lesson.content, 
              lesson.quiz.question, 
              lesson.quiz.options
            );
          } else {
            await sendInteractiveMessage(
              phoneNumber, 
              lesson.title, 
              lesson.content, 
              null, 
              []
            );
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

    console.log(`📅 Lessons scheduled for course "${course.name}" at ${scheduleTime} daily (${timezone})`);
    console.log(`📊 Total lessons to send: ${totalLessons}`);
    console.log(`⏰ Next lesson will be sent: ${scheduledTask.nextDate().toLocaleString()}`);

    return {
      success: true,
      message: `Scheduled ${totalLessons} lessons for daily delivery at ${scheduleTime}`,
      courseId: courseId,
      totalLessons: totalLessons,
      scheduleTime: scheduleTime,
      timezone: timezone,
      nextExecution: scheduledTask.nextDate().toISOString()
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
const createCourse = async (numbers, courseData, lessonsData) => {
    try {
        const course = await prisma.course.create({
            data: {
                name: courseData.name,
                description: courseData.description,
                coverImage: courseData.coverImage ? courseData.coverImage : null,
                adminId: courseData.adminId,
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
          await sendTemplateMessage(to, 'new_courses', 'en', { header: [courseData.name], body: [courseData.description] });
          await delay(3000);

          if (courseData.coverImage) await sendImageMessage(to, courseData.coverImage);
          await delay(3000);

          for (const lesson of lessonsData) {
            if (lesson.quiz) {
              await sendInteractiveMessage(
                to, 
                lesson.title, 
                lesson.content, 
                lesson.quiz.question, 
                lesson.quiz.options
              );
            } else {
              await sendInteractiveMessage(
                to, 
                lesson.title, 
                lesson.content, 
                null, 
                []
              );
            }
          }
          
          // SCHEDULE FEATURE: Send lessons at specified times instead of immediately
          // This replaces the immediate lesson sending with scheduled delivery
          //await scheduleLessons(course.id, numbers);
        }

        return { course, lessons, quizzes, enrollments };
    } catch (error) {
        throw new Error('Failed to create course: ' + error.message);
    }
};

const deleteAllCourses = async () => {
  try {
      return prisma.course.deleteMany({});;
  } catch (error) {
      throw new Error('Failed to delete course');
  }
}



module.exports = {
    createCourse,
    deleteAllCourses,
    scheduleLessons,
}

/*
{
  "courseData": {
    "name": "Introduction to Node.js",
    "description": "Learn the fundamentals of Node.js development",
    "coverImage": "https://example.com/nodejs-cover.jpg",
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
  "enrollmentsData": [
    {
      "learnerId": 2
    },
    {
      "learnerId": 3
    },
    {
      "learnerId": 4
    }
  ],
  "numbers": [
    "+1234567890",
    "+0987654321"
  ]
}
  */