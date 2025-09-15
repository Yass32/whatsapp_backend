/**
 * Course Service Module
 * 
 * This module handles all course-related operations including:
 * - Creating courses with lessons and quizzes
 * - Scheduling automated lesson delivery
 * - Managing course progress and enrollments
 * - Sending course notifications via WhatsApp
 * 
 * @author Your Name
 * @version 1.0.0
 */

// Import required dependencies
const cron = require('node-cron'); // Cron job scheduler for automated tasks
const cronParser = require('cron-parser'); // Parse cron expressions for scheduling
const { PrismaClient } = require('../generated/prisma'); // Database ORM client
const { withAccelerate } = require('@prisma/extension-accelerate'); // Prisma performance extension
const { sendTextMessage, sendImageMessage, sendTemplateMessage, sendInteractiveMessage, sendInteractiveListMessage } = require('../services/whatsappService'); // WhatsApp messaging functions
const { storeMessageContext } = require('../services/webhookService'); // Message context storage for replies
const { lessonQueue, reminderQueue, notificationQueue, addJobToQueue } = require('./queueService');

// Initialize Prisma client with acceleration for better performance
const prisma = new PrismaClient().$extends(withAccelerate());


/**
 * Schedule lessons to be sent at specific times with configurable frequency
 * 
 * This function creates automated cron jobs that will send course lessons
 * to enrolled learners at specified intervals (daily, weekly, or monthly).
 * Each lesson is sent with its associated quiz if available.
 * 
 * @param {number} courseId - The database ID of the course to schedule
 * @param {Array} numbers - Array of WhatsApp phone numbers to send lessons to
 * @param {string} scheduleTime - Time in format "HH:MM" (24-hour format, e.g., "10:00")
 * @param {string} startDate - Start date in format "YYYY-MM-DD" (optional, defaults to today)
 * @param {string} frequency - Delivery frequency: "daily", "weekly", or "monthly"
 * @param {string} timezone - Timezone for scheduling (defaults to "Europe/Istanbul")
 * @returns {Object} Scheduling result with course info and next execution time
 * @throws {Error} If course not found or scheduling parameters are invalid
 */
const scheduleLessons = async (courseId, numbers, scheduleTime = "12:15", startDate = null, frequency = "daily", timezone = "Europe/Istanbul") => {
  try {
    // Fetch the course from database with all lessons and their quizzes
    const course = await prisma.course.findUnique({
      where: { id: courseId }, // Find course by ID
      include: {
        lessons: { // Include all lessons for this course
          include: {
            quiz: true // Include quiz data for each lesson
          },
          orderBy: {
            day: 'asc' // Order lessons by day number (1, 2, 3, etc.)
          }
        }
      }
    });

    // Validate that the course exists in the database
    if (!course) {
      throw new Error('Course not found'); // Fail if course ID doesn't exist
    }

    // Parse and validate the schedule time format (HH:MM)
    const [hour, minute] = scheduleTime.split(':').map(Number); // Split "10:00" into [10, 0]
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      throw new Error('Invalid time format. Use HH:MM in 24-hour format'); // Validate time range
    }

    // Handle and validate start date parameter
    let schedulingStartDate = new Date(); // Default to today
    if (startDate) {
      schedulingStartDate = new Date(startDate); // Parse provided start date
      if (isNaN(schedulingStartDate.getTime())) {
        throw new Error('Invalid start date format. Use YYYY-MM-DD'); // Validate date format
      }
    }

    // Validate frequency parameter against allowed values
    const validFrequencies = ['daily', 'weekly', 'monthly'];
    if (!validFrequencies.includes(frequency.toLowerCase())) {
      throw new Error('Invalid frequency. Use "daily", "weekly", or "monthly"'); // Fail for invalid frequency
    }

    // Initialize lesson tracking variables
    let currentLessonIndex = 0; // Track which lesson to send next (starts at 0)
    const totalLessons = course.lessons.length; // Total number of lessons in the course
    let lastReminderSent = -1; // Track which lesson we last sent a reminder for
    


    // === CRON EXPRESSION GENERATION ===
    const generateCronExpression = (hour, minute, frequency, date) => {
        let cronExpression;
        switch (frequency.toLowerCase()) {
            case 'daily':
                cronExpression = `${minute} ${hour} * * *`;
                break;
            case 'weekly':
                cronExpression = `${minute} ${hour} * * ${date.getDay()}`;
                break;
            case 'monthly':
                cronExpression = `${minute} ${hour} ${date.getDate()} * *`;
                break;
            default:
                throw new Error('Invalid frequency for cron generation.');
        }
        return cronExpression;
    };

    // Reminder is 2 hours before the lesson
    const reminderHour = (hour - 1 + 24) % 24;
    let reminderCronExpression = generateCronExpression(reminderHour, minute, frequency, schedulingStartDate);
    // Reminder: one minute before each lesson: 5,11,17,23,29...
    reminderCronExpression = '5-59/6 * * * *';  // TODO: Remove for production

    // Lesson delivery cron
    let lessonCronExpression = generateCronExpression(hour, minute, frequency, schedulingStartDate);
    // Lesson: every 6 minutes at 0,6,12,18,24...
    lessonCronExpression = "*/6 * * * *"; // TODO: Remove for production

    // === CRON JOB SCHEDULING ===
    const reminderTask = cron.schedule(reminderCronExpression, async () => {
      const currentDate = new Date();
      if (currentDate < schedulingStartDate || currentLessonIndex >= totalLessons) {
        if (currentLessonIndex >= totalLessons) {
            console.log(`✅ All reminders for course "${course.name}" completed. Stopping reminder scheduler.`);
            reminderTask.stop();
        }
        return;
      }

      // Send reminder only if it hasn't been sent for the current lesson
      if (lastReminderSent !== currentLessonIndex) {
        const upcomingLesson = course.lessons[currentLessonIndex];
        console.log(`📢 Queuing reminders for lesson ${currentLessonIndex + 1}/${totalLessons}: "${upcomingLesson.title}"`);
        // Add job to queue for each learner
        for (const phoneNumber of numbers) {
          addJobToQueue(reminderQueue, 'sendReminder', { phoneNumber, lesson: upcomingLesson, course, currentLessonIndex });
        }
        lastReminderSent = currentLessonIndex; // Mark as sent
      }
    }, { scheduled: true, timezone });

    const scheduledTask = cron.schedule(lessonCronExpression, async () => {
      const currentDate = new Date();
      if (currentDate < schedulingStartDate) {
        console.log(`⏳ Waiting for start date: ${schedulingStartDate.toDateString()}`);
        return;
      }

      if (currentLessonIndex >= totalLessons) {
        console.log(`✅ All lessons for course "${course.name}" have been sent. Stopping scheduler.`);
        scheduledTask.stop();
        reminderTask.stop();
        return;
      }

      const lesson = course.lessons[currentLessonIndex];
      console.log(`📚 Queuing lesson ${currentLessonIndex + 1}/${totalLessons}: "${lesson.title}"`);
      // Add job to queue for each learner
      for (const phoneNumber of numbers) {
        addJobToQueue(lessonQueue, 'sendLesson', { phoneNumber, frequency, lesson, course, currentLessonIndex });
      }
      currentLessonIndex++; // Move to the next lesson
    }, { scheduled: true, timezone });

    // Calculate when the next lesson will be sent using cron parser
    let nextExecution;
    try {
      // Parse the cron expression to get next execution time
      const interval = cronParser.CronExpressionParser.parse(lessonCronExpression, { currentDate: new Date(), tz: timezone });
      nextExecution = interval.next().toDate(); // Get next execution as Date object
    } catch (err) {
      // Fallback to start date if cron parsing fails
      console.error("Failed to parse next cron execution:", err.message);
      nextExecution = schedulingStartDate;
    }

    // Log scheduling confirmation details
    console.log(`📅 Lessons scheduled for course "${course.name}" at ${scheduleTime} ${frequency} (${timezone})`);
    console.log(`📊 Total lessons to send: ${totalLessons}`);
    console.log(`🚀 Start date: ${schedulingStartDate.toDateString()}`);
    console.log(`⏰ Next lesson will be sent: ${nextExecution.toLocaleString()}`);

    // Return scheduling result object
    return {
      success: true, // Indicates successful scheduling
      message: `Scheduled ${totalLessons} lessons for ${frequency} delivery at ${scheduleTime}`, // Human-readable message
      courseId: courseId, // Course ID for reference
      totalLessons: totalLessons, // Number of lessons to be sent
      scheduleTime: scheduleTime, // Time of day for delivery
      startDate: schedulingStartDate.toISOString().split('T')[0], // Start date in YYYY-MM-DD format
      frequency: frequency, // Delivery frequency
      timezone: timezone, // Timezone for scheduling
      nextExecution: nextExecution.toISOString() // Next execution time in ISO format
    };

  } catch (error) {
    // Log the error and re-throw with descriptive message
    console.error('Error scheduling lessons:', error);
    throw new Error('Failed to schedule lessons: ' + error.message);
  }
};



/**
 * Create a complete course with lessons, quizzes, and enrollments in a single database transaction
 * 
 * This function performs the following operations atomically:
 * 1. Creates the course record
 * 2. Creates all lessons and their associated quizzes
 * 3. Creates enrollments for all valid learners
 * 4. Sends course notifications via WhatsApp
 * 5. Schedules automated lesson delivery
 * 
 * @param {Array} numbers - Array of WhatsApp phone numbers to enroll
 * @param {Object} courseData - Course information: { name, description, coverImage, adminId }
 * @param {Array} lessonsData - Array of lesson objects: { title, content, day, quiz }
 * @param {string} scheduleTime - Time for lesson delivery in "HH:MM" format
 * @param {string} startDate - Course start date in "YYYY-MM-DD" format
 * @param {string} frequency - Lesson delivery frequency: "daily", "weekly", or "monthly"
 * @returns {Object} Result object with course, lessons, quizzes, enrollments, and scheduling info
 * @throws {Error} If validation fails or database transaction fails
 */
const createCourse = async (numbers, courseData, lessonsData, scheduleTime, startDate, frequency) => {
  // Validate required parameters before starting transaction
  if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
    throw new Error('At least one phone number is required'); // Must have recipients
  }
  if (!courseData || !courseData.name || !courseData.description) {
    throw new Error('Course name and description are required'); // Must have basic course info
  }
  if (!lessonsData || !Array.isArray(lessonsData) || lessonsData.length === 0) {
    throw new Error('At least one lesson is required'); // Must have content to teach
  }


  // Start a database transaction to ensure all operations succeed or fail together
  const { course, lessons, quizzes, enrollments, learnersToNotify } = await prisma.$transaction(async (tx) => {
    try {
      // Step 1: Create the main course record with DRAFT status by default
      const course = await tx.course.create({
        data: {
          name: courseData.name, // Course title
          description: courseData.description, // Course description
          coverImage: courseData.coverImage || null, // Optional cover image URL
          status: 'DRAFT', // Default status for new courses
          adminId: Number(courseData.adminId), // ID of the admin who created this course
          totalLessons: lessonsData.length, // Count of lessons for progress tracking
          totalQuizzes: lessonsData.reduce((total, lesson) => total + (lesson.quiz ? 1 : 0), 0), // Count quizzes
        },
      });

      // Step 2: Create all lessons and their associated quizzes
      const lessons = []; // Array to store created lesson records
      const quizzes = []; // Array to store created quiz records
      
      // Process each lesson in the provided lessons data
      for (const lesson of lessonsData) {
        // Validate that each lesson has required fields

        if (!lesson.title || !lesson.content || Number.isNaN(lesson.day)) {
          throw new Error('Each lesson must have a title, content, and numeric day');
        }

        // Create the lesson record in the database
        const createdLesson = await tx.lesson.create({
          data: {
            title: lesson.title, // Lesson title/name
            content: lesson.content, // Main lesson content/text
            courseId: course.id, // Link to the parent course
            day: Number(lesson.day) // Day number for ordering (1, 2, 3, etc.)
          }
        });
        lessons.push(createdLesson); // Add to results array

        // Create quiz if this lesson has quiz data
        if (lesson.quiz) {
          // Validate quiz data structure
          if (!lesson.quiz.question || !Array.isArray(lesson.quiz.options) || 
              !lesson.quiz.correctOption) {
            throw new Error('Quiz must have a question, options array, and correctOption'); // Fail if quiz data incomplete
          }

          // Create the quiz record linked to this lesson
          const createdQuiz = await tx.quiz.create({
            data: {
              lessonId: createdLesson.id, // Link to the parent lesson
              question: lesson.quiz.question, // Quiz question text
              options: lesson.quiz.options, // Array of possible answers
              correctOption: lesson.quiz.correctOption // The correct answer
            }
          });
          quizzes.push(createdQuiz); // Add to results array
        }
      }

      // Step 3: Create enrollments for all valid learners
      // First, find all learners that exist with the provided phone numbers
      const learners = await tx.learner.findMany({
        where: { number: { in: numbers } } // Find learners whose numbers are in our array
      });

      // Ensure we found at least one valid learner
      if (learners.length === 0) {
        throw new Error('No valid learners found with the provided phone numbers'); // Fail if no learners exist
      }

      // Create enrollment records for each found learner
      const enrollments = await tx.enrollment.createMany({
        data: learners.map(learner => ({ // Create enrollment linking learner to course
          learnerId: learner.id, // ID of the learner
          courseId: course.id // ID of the course
        })),
        skipDuplicates: true
      });


      return { course, lessons, quizzes, enrollments, learnersToNotify: learners.map(learner => learner.number) /* Enroll and notify only learners that exist in DB*/ };

    } catch (error) {
      // Log the specific error that occurred during course creation
      console.error('Failed to create course:', error.code, error.message);
      // Re-throw with descriptive message for the caller
      throw new Error('Failed to create course: ' + error.message);
    }
  }); // End of database transaction

  if (course.status === 'DRAFT') {
    console.log(`Course "${course.name}" created successfully in DRAFT status.`);
    return { course, lessons, quizzes, enrollments, learnersToNotify };
  }

  // Step 4: Queue course notifications for all enrolled learners
  console.log(`📲 Queuing notifications for course "${course.name}" to ${learnersToNotify.length} learners.`);
  // Add job to queue for each learner
  for (const to of learnersToNotify) {
    addJobToQueue(notificationQueue, 'sendNotification', { to, courseData, course });
  }

  // Step 5: Schedule automated lesson delivery
  // This creates cron jobs to send lessons at specified times instead of immediately
  const scheduleLessonsResponse = await scheduleLessons(course.id, numbers, scheduleTime, startDate, frequency);

  // Return all created data for confirmation
  return { scheduleLessonsResponse, course, lessons, quizzes, enrollments };
};



/**
 * Update learner's progress for a course lesson or quiz
 * 
 * This function handles two types of progress updates:
 * 1. Lesson completion (when quizReply is null)
 * 2. Quiz answer submission (when quizReply is provided)
 * 
 * @param {string} phoneNumber - Learner's WhatsApp phone number
 * @param {number} courseId - ID of the course being progressed
 * @param {number} lessonId - ID of the lesson being completed/answered
 * @param {string|null} quizReply - Quiz answer from learner (null for lesson completion)
 * @returns {Object} Object containing updated progress and correct answer (if quiz)
 * @throws {Object} Error object if learner or course not found
 */
const updateCourseProgress = async (phoneNumber, courseId, lessonId, quizReply = null) => {
  let correct = null; // Will store correct answer if this is a quiz response

  // Find the learner by their phone number
  const learner = await prisma.learner.findFirst({ where: { number: phoneNumber } });
  if (!learner) return { error: "Learner not found" }; // Return error if learner doesn't exist

  // Find the course with lesson count for progress calculation
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { _count: { select: { lessons: true } } } // Get total lesson count
  });
  if (!course) return { error: "Course not found" }; // Return error if course doesn't exist

  // Get existing progress record or create new one
  let progress = await prisma.courseProgress.findUnique({
    where: { learnerId_courseId: { learnerId: learner.id, courseId } } // Composite key lookup
  });

  // Create initial progress record if none exists
  if (!progress) {
    progress = await prisma.courseProgress.create({
      data: { learnerId: learner.id, courseId } // Create with default values
    });
  }

  // Handle quiz answer submission
  if (quizReply && lessonId) {
    // Find the quiz for this lesson
    const quiz = await prisma.quiz.findUnique({
      where: { lessonId: lessonId }
    });

    if (quiz) {
      // Check if the answer is correct
      if (quizReply === quiz.correctOption || quizReply === quiz.correctOption.substring(0, 22) + '..') {
        // Update quiz score by adding percentage points
        progress = await prisma.courseProgress.update({
          where: { id: progress.id },
          data: {
            quizScore: Math.round(
              ((progress.quizScore || 0) + (100 / course.totalQuizzes)) // Add points based on total quizzes
            )
          }
        });
      } else {
        // Dont update score and inform user of correct answer
        correct = quiz.correctOption; // Return correct answer for confirmation
      }
    }

  } 
  // Handle lesson completion (no quiz reply)
  else if (!quizReply) {
    // Update lesson completion progress
    progress = await prisma.courseProgress.update({
      where: { id: progress.id },
      data: {
        completedLessons: { increment: 1 }, // Increment completed lesson count
        progressPercent: Math.round(
          ((progress.completedLessons + 1) / course.totalLessons) * 100 // Calculate percentage
        ),
        isCompleted: progress.completedLessons + 1 >= course.totalLessons, // Mark complete if all lessons done
        completedAt: progress.completedLessons + 1 >= course.totalLessons 
          ? new Date() // Set completion timestamp if course finished
          : null
      }
    });
  }

  // Return updated progress and correct answer (if applicable)
  return { progress, correct };
};

/**
 * Delete all courses and their related data from the database
 * 
 * This function performs a cascading delete of all course-related data
 * in the correct order to respect foreign key constraints:
 * 1. Message contexts (references courses/lessons/quizzes)
 * 2. Course progress records (references courses and learners)
 * 3. Enrollments (references courses and learners)
 * 4. Quizzes (references lessons)
 * 5. Lessons (references courses)
 * 6. Courses (parent records)
 * 
 * @returns {Object} Success result object
 * @throws {Error} If deletion fails
 */
const deleteAllCourses = async () => {
  try {
    // Delete all course-related data in correct order using transaction
    await prisma.$transaction([
      prisma.messageContext.deleteMany({}), // Delete message contexts first (references courses/lessons/quizzes)
      prisma.courseProgress.deleteMany({}), // Delete progress records (references courses)
      prisma.enrollment.deleteMany({}), // Delete enrollments (references courses and learners)
      prisma.quiz.deleteMany({}), // Delete quizzes (references lessons)
      prisma.lesson.deleteMany({}), // Delete lessons (references courses)
      prisma.course.deleteMany({}) // Delete courses last (parent records)
    ]);
    return { success: true, message: 'All courses and dependencies deleted successfully' };
  } catch (error) {
    // Log error details and re-throw
    console.error("Failed to delete all courses and their dependencies:", error);
    throw error;
  }
};  

/**
 * Get all courses created by a specific admin
 * 
 * Fetches all courses along with their lessons and quizzes that were created by the specified admin.
 * 
 * @param {string} adminId - The ID of the admin whose courses to retrieve
 * @returns {Promise<Array>} Array of course objects with nested lessons and quizzes
 * @throws {Error} If database query fails
 */
const getAdminCourses = async (adminId) => {
  try {
    // First, get all courses with their lessons
    const courses = await prisma.course.findMany({
      where: {
        adminId: adminId // Filter courses by the specified admin ID
      },
      include: {
        lessons: {
          include: {
            quiz: true // Include any quizzes associated with each lesson
          },
          orderBy: {
            day: 'asc' // Order lessons by day in ascending order
          }
        },
        courseProgress: {
          select: {
            progressPercent: true // We only need the progress percentage
          }
        },
        _count: {
          select: {
            enrollments: true // Get the count of enrollments directly
          }
        }
      },
      orderBy: {
        createdAt: 'desc' // Show most recently created courses first
      }
    });

    // Calculate average progress for each course
    const coursesWithProgress = courses.map(course => {
      const totalEnrollments = course._count.enrollments;
      const totalProgress = course.courseProgress.reduce(
        (sum, progress) => sum + (progress.progressPercent || 0), 0
      );
      const averageProgress = course.courseProgress.length > 0 
        ? Math.round((totalProgress / course.courseProgress.length) * 100) / 100 // Round to 2 decimal places
        : 0;

      // Remove internal fields from the response
      const { courseProgress, _count, ...courseData } = course;
      
      return {
        ...courseData,
        averageProgress,
        totalEnrollments
      };
    });

    // Get total learners count across all courses
    const learnersCount = await prisma.learner.count({
      where: {
        adminId: adminId
      }
    });

    // Number of groups created by admin
    const groupsCount = await prisma.group.count({
      where: {
        adminId: adminId
      }
    });

    return { 
      courses: coursesWithProgress, 
      learnersCount, 
      groupsCount 
    };
  } catch (error) {
    console.error('Error fetching admin courses:', error);
    throw new Error('Failed to retrieve admin courses');
  }
};

/**
 * Publish a course (change status from DRAFT to PUBLISHED)
 * @param {number} courseId - The ID of the course to publish
 * @param {number} adminId - The ID of the admin publishing the course
 * @returns {Promise<Object>} The updated course
 */
const publishCourse = async (courseId, adminId) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId, adminId }
    });

    if (!course) {
      throw new Error('Course not found or you do not have permission');
    }

    if (course.status === 'PUBLISHED') {
      throw new Error('Course is already published');
    }

    return await prisma.course.update({
      where: { id: courseId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date()
      },
      include: {
        lessons: true
      }
    });
  } catch (error) {
    console.error('Error publishing course:', error);
    throw error;
  }
};

/**
 * Archive a course (change status to ARCHIVED)
 * @param {number} courseId - The ID of the course to archive
 * @param {number} adminId - The ID of the admin archiving the course
 * @returns {Promise<Object>} The updated course
 */
const archiveCourse = async (courseId, adminId) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId, adminId }
    });

    if (!course) {
      throw new Error('Course not found or you do not have permission');
    }

    return await prisma.course.update({
      where: { id: courseId },
      data: {
        status: 'ARCHIVED'
      }
    });
  } catch (error) {
    console.error('Error archiving course:', error);
    throw error;
  }
};

/**
 * Get courses by status
 * @param {number} adminId - The ID of the admin
 * @param {string} status - Status filter (DRAFT, PUBLISHED, ARCHIVED)
 * @returns {Promise<Array>} List of courses
 */
const getCoursesByStatus = async (adminId, status) => {
  try {
    return await prisma.course.findMany({
      where: { 
        adminId,
        ...(status && { status })
      },
      include: {
        lessons: {
          include: {
            quiz: true
          },
          orderBy: {
            day: 'asc'
          }
        },
        _count: {
          select: {
            enrollments: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  } catch (error) {
    console.error('Error getting courses by status:', error);
    throw error;
  }
};

/**
 * Update an existing draft course with new data
 * @param {number} courseId - ID of the course to update
 * @param {number} adminId - ID of the admin making the update
 * @param {Object} courseData - Updated course data
 * @param {Array} lessonsData - Updated lessons data
 * @returns {Promise<Object>} Updated course with lessons and quizzes
 */
const updateCourse = async (courseId, adminId, courseData, lessonsData = []) => {
  // Validate input
  if (!courseId || !adminId) {
    throw new Error('Course ID and admin ID are required');
  }

  // Start a database transaction
  return await prisma.$transaction(async (tx) => {
    try {
      // 1. Verify the course exists, is a draft, and belongs to the admin
      const existingCourse = await tx.course.findUnique({
        where: { id: courseId },
        include: { lessons: { include: { quiz: true } } }
      });

      if (!existingCourse) {
        throw new Error('Course not found');
      }

      if (existingCourse.adminId !== adminId) {
        throw new Error('You do not have permission to update this course');
      }

      if (existingCourse.status !== 'DRAFT') {
        throw new Error('Only draft courses can be updated');
      }

      // 2. Update the course details
      const updatedCourse = await tx.course.update({
        where: { id: courseId },
        data: {
          name: courseData.name || existingCourse.name,
          description: courseData.description || existingCourse.description,
          coverImage: courseData.coverImage !== undefined ? courseData.coverImage : existingCourse.coverImage,
          totalLessons: lessonsData.length || existingCourse.totalLessons,
          totalQuizzes: lessonsData.length 
            ? lessonsData.filter(lesson => lesson.quiz).length 
            : existingCourse.totalQuizzes,
          updatedAt: new Date()
        },
        include: {
          lessons: true
        }
      });

      // If no lessons data provided, return the updated course as is
      if (!lessonsData || lessonsData.length === 0) {
        return updatedCourse;
      }

      // 3. Handle lessons and quizzes updates
      const existingLessons = existingCourse.lessons || [];
      const updatedLessons = [];
      const updatedQuizzes = [];

      // Process each lesson in the provided lessons data
      for (const lessonData of lessonsData) {
        // Validate lesson data
        if (!lessonData.title || !lessonData.content || lessonData.day === undefined) {
          throw new Error('Each lesson must have a title, content, and day number');
        }

        // Check if this is an existing lesson (has an ID) or a new one
        const existingLesson = existingLessons.find(l => l.id === lessonData.id);
        
        if (existingLesson) {
          // Update existing lesson
          const updatedLesson = await tx.lesson.update({
            where: { id: existingLesson.id },
            data: {
              title: lessonData.title,
              content: lessonData.content,
              day: Number(lessonData.day),
              updatedAt: new Date()
            },
            include: { quiz: true }
          });
          updatedLessons.push(updatedLesson);

          // Handle quiz update if exists
          if (lessonData.quiz) {
            if (existingLesson.quiz) {
              // Update existing quiz
              const updatedQuiz = await tx.quiz.update({
                where: { lessonId: existingLesson.id },
                data: {
                  question: lessonData.quiz.question,
                  options: Array.isArray(lessonData.quiz.options) 
                    ? lessonData.quiz.options 
                    : JSON.parse(lessonData.quiz.options || '[]'),
                  correctOption: lessonData.quiz.correctOption,
                  updatedAt: new Date()
                }
              });
              updatedQuizzes.push(updatedQuiz);
            } else {
              // Create new quiz
              const newQuiz = await tx.quiz.create({
                data: {
                  question: lessonData.quiz.question,
                  options: Array.isArray(lessonData.quiz.options) 
                    ? lessonData.quiz.options 
                    : JSON.parse(lessonData.quiz.options || '[]'),
                  correctOption: lessonData.quiz.correctOption,
                  lesson: { connect: { id: existingLesson.id } }
                }
              });
              updatedQuizzes.push(newQuiz);
            }
          } else if (existingLesson.quiz) {
            // Remove quiz if it existed but not in the update
            await tx.quiz.delete({ where: { lessonId: existingLesson.id } });
          }
        } else {
          // Create new lesson
          const newLesson = await tx.lesson.create({
            data: {
              title: lessonData.title,
              content: lessonData.content,
              day: Number(lessonData.day),
              course: { connect: { id: courseId } },
              ...(lessonData.quiz && {
                quiz: {
                  create: {
                    question: lessonData.quiz.question,
                    options: Array.isArray(lessonData.quiz.options) 
                      ? lessonData.quiz.options 
                      : JSON.parse(lessonData.quiz.options || '[]'),
                    correctOption: lessonData.quiz.correctOption
                  }
                }
              })
            },
            include: { quiz: true }
          });
          updatedLessons.push(newLesson);
          if (newLesson.quiz) {
            updatedQuizzes.push(newLesson.quiz);
          }
        }
      }

      // 4. Delete lessons that weren't included in the update
      const updatedLessonIds = updatedLessons.map(l => l.id);
      const lessonsToDelete = existingLessons.filter(l => !updatedLessonIds.includes(l.id));
      
      if (lessonsToDelete.length > 0) {
        await tx.lesson.deleteMany({
          where: {
            id: { in: lessonsToDelete.map(l => l.id) }
          }
        });
      }

      // 5. Return the complete updated course with lessons and quizzes
      return {
        ...updatedCourse,
        lessons: updatedLessons,
        quizzes: updatedQuizzes
      };

    } catch (error) {
      console.error('Error updating course:', error);
      throw new Error(`Failed to update course: ${error.message}`);
    }
  });
};

// Export all course service functions for use in other modules
module.exports = {
  createCourse, // Function to create complete courses with lessons, quizzes, and enrollments
  updateCourse, // Function to update existing draft courses
  updateCourseProgress, // Function to track learner progress through lessons and quizzes
  getAdminCourses,  // Function to get all courses for the logged-in admin
  getCoursesByStatus, // Function to get courses by status
  publishCourse, // Function to publish a draft course
  archiveCourse, // Function to archive a course
  deleteAllCourses, // Function to delete all course data (for testing/cleanup)
  scheduleLessons // Function to schedule automated lesson delivery via cron jobs
}
/*
{
  "courseData": {
    "name": "Türk Mutfağına Giriş",
    "description": "Türk yemek kültürünün temellerini ve geleneksel tarifleri öğrenin",
    "coverImage": "https://ofy.org/wp-content/uploads/2015/11/OFY-learning-to-learn-cover-photo.jpg",
    "adminId": 1
  },
  "lessonsData": [
    {
      "title": "Türk Mutfağına Genel Bakış",
      "content": "Türk mutfağı, Osmanlı İmparatorluğu'nun mirasını taşıyan, zengin çeşitliliğe sahip bir dünya mutfağıdır. Anadolu, Orta Asya, Orta Doğu ve Balkan mutfaklarının harmanlanmasıyla oluşmuştur.",
      "day": 1,
      "quiz": {
        "question": "Türk mutfağı hangi mutfakların harmanlanmasıyla oluşmuştur?",
        "options": ["A. Anadolu ve Orta Asya", "B. Orta Doğu ve Balkan", "C. İtalyan ve Fransız", "D. Bilmiyorum"],
        "correctOption": "A. Anadolu ve Orta Asya"
      }
    },
    {
      "title": "Türk Mutfağının Temelleri",
      "content": "Türk mutfağı, zengin bir tarih ve çeşitliliğe sahiptir. Temel pişirme yöntemleri arasında ızgara, tencere yemekleri ve zeytinyağlılar bulunur. Geleneksel tarifler genellikle taze sebzeler, etler ve bakliyatlar kullanır.",
      "day": 2,
      "quiz": {
        "question": "Türk mutfağının temel pişirme yöntemlerinden biri değildir?",
        "options": ["A. Izgara", "B. Tencere yemekleri", "C. Zeytinyağlılar", "D. Sushi yapımı"],
        "correctOption": "D. Sushi yapımı"
      }
    },
    {
      "title": "Bölgesel Türk Yemekleri",
      "content": "Türkiye'nin yedi bölgesi kendine has yemeklere sahiptir. Güneydoğu'da kebap ve lahmacun, Karadeniz'de hamsi ve mıhlama, Ege'de zeytinyağlılar ve ot yemekleri öne çıkar.",
      "day": 3
    }
  ],
  "numbers": [
    "905359840140",
    "905548411974", 
    "905051190856"
  ]
}
*/