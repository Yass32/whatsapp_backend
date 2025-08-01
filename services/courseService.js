const { PrismaClient } = require('../generated/prisma');
const { withAccelerate } = require('@prisma/extension-accelerate'); 
const bcrypt = require('bcrypt');
const jwt = require("jsonwebtoken");
const {sendTextMessage, sendImageMessage, sendTemplateMessage, sendInteractiveMessage} = require('../services/whatsappService')

const prisma = new PrismaClient().$extends(withAccelerate())

/**
 * Create a course with nested lessons and enrollments in a single transaction.
 * @param {Object} courseData - { name, description, coverImage, adminId }
 * @param {Array} lessonsData - Array of lesson objects: { title, content, day, quiz }
 * @param {Array} enrollmentsData - Array of enrollment objects: { learnerId }
 * @param {Array} numbers - Array of WhatsApp numbers to notify
 */
const createCourse = async (courseData, lessonsData, enrollmentsData, numbers) => {
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
        const enrollments = await Promise.all(
            enrollmentsData.map(enrollment =>
                prisma.enrollment.create({
                    data: {
                        learnerId: enrollment.learnerId,
                        courseId: course.id
                    }
                })
            )
        );

        // Notify all numbers about the new course
        for (const to of numbers) {
          //sendTemplateMessage(to, 'new_course', 'en', [courseData.name, courseData.description]);
          await sendTextMessage(to, courseData.name);
          if (courseData.coverImage) await sendImageMessage(to, courseData.coverImage);
          await sendTextMessage(to, courseData.description);
          
          // Send lessons with quizzes
          for (const lesson of lessonsData) {
            if (lesson.quiz) {
              await sendInteractiveMessage(to, lesson.title, lesson.content, lesson.quiz.question, lesson.quiz.options);
            } else {
              // Send lesson without quiz
              await sendInteractiveMessage(to, lesson.title, lesson.content, null, []);
            }
          }
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
    deleteAllCourses
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