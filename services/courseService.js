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
            sendTemplateMessage(to, 'new_course', 'en', [courseData.name, courseData.description]);
            sendTextMessage(to, courseData.name);
            if (courseData.coverImage) sendImageMessage(to, courseData.coverImage);
            sendTextMessage(to, courseData.description);
        }

        return { course, lessons, quizzes, enrollments };
    } catch (error) {
        throw new Error('Failed to create course: ' + error.message);
    }
};


module.exports = {
    createCourse,
}