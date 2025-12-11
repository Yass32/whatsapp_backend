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
const { PrismaClient } = require('@prisma/client'); // Database ORM client
const { withAccelerate } = require('@prisma/extension-accelerate'); // Prisma performance extension
const { sendTextMessage, sendImageMessage, sendTemplateMessage, sendInteractiveMessage, sendInteractiveListMessage } = require('../services/whatsappService'); // WhatsApp messaging functions
const { storeMessageContext } = require('../services/webhookService'); // Message context storage for replies
const { lessonQueue, reminderQueue, notificationQueue, textQueue, addJobToQueue } = require('./queueService');

// Initialize Prisma client with acceleration for better performance
const prisma = new PrismaClient().$extends(withAccelerate());


// Helper function to format scheduled date and time
function formatScheduledDateTime(dateStr, timeStr) {
  // Parse the date and time
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  // Create a date object
  const date = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  
  // Format as ISO string with timezone offset
  return date.toISOString().replace('Z', '+00:00');
}

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
const scheduleLessons = async (courseId, numbers, scheduleTime, startDate = null, frequency = "daily", timezone = "Europe/Istanbul") => {
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
    const reminderHour = (hour - 2 + 24) % 24;  // Fixed: 2 hours before, not 1
    let reminderCronExpression = generateCronExpression(reminderHour, minute, frequency, schedulingStartDate);
    
    // Lesson delivery cron
    let lessonCronExpression = generateCronExpression(hour, minute, frequency, schedulingStartDate);
    
    // === TESTING OVERRIDES (Comment out for production) ===
    // Uncomment these lines ONLY for testing with faster intervals:
    //reminderCronExpression = '5-59/6 * * * *';  // Test: every 6 min starting at :05
    //lessonCronExpression = '*/6 * * * *';       // Test: every 6 min starting at :00

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
const createCourse = async (courseData, lessonsData, learnerIds, scheduleTime='09:00', startDate=new Date().toISOString().split('T')[0], frequency='daily') => {
  // Validate required parameters before starting transaction
  if (!learnerIds || !Array.isArray(learnerIds) || learnerIds.length === 0) {
    throw new Error('At least one learner ID is required'); // Must have recipients
  }
  if (!courseData || !courseData.name || !courseData.description) {
    throw new Error('Course name and description are required'); // Must have basic course info
  }
  if (!lessonsData || !Array.isArray(lessonsData) || lessonsData.length === 0) {
    throw new Error('At least one lesson is required'); // Must have content to teach
  }
  if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(scheduleTime)) {
    throw new Error('Invalid schedule time format. Use HH:MM (24-hour format)'); // Time format validation (HH:MM)
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
          status: courseData.status || 'PUBLISHED', // Default status for new courses
          publishedAt: formatScheduledDateTime(startDate, scheduleTime), // Course start date
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
            day: Number(lesson.day), // Day number for ordering (1, 2, 3, etc.)
            document: lesson.document || null, // Document file path
            media: lesson.media || null, // Media file path
            externalLink: lesson.externalLink || null, // External link URL
          }
        });
        lessons.push(createdLesson); // Add to results array

        // Create quiz if this lesson has quiz data
        if (lesson.quiz) {
          // Validate quiz data structure
          if (!lesson.quiz.question || lesson.quiz.question.trim() === '') {
            throw new Error(`Leasson "${lesson.title}" must have a question`);
          }
          if (!lesson.quiz.options || !Array.isArray(lesson.quiz.options)){
            throw new Error(`Lesson "${lesson.title}" must have at least 2 quiz options`);
          }
          if (!lesson.quiz.correctOption || lesson.quiz.correctOption.trim() === '') {
            throw new Error(`Lesson "${lesson.title}" must have a correct option`);
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
        where: { id: { in: learnerIds } } // Find learners whose numbers are in our array
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

  // If course is draft, return course data and don't schedule lessons
  if (course.status === 'DRAFT') {
    console.log(`Course "${course.name}" created successfully in DRAFT status.`);
    return { course, lessons, quizzes, enrollments };
  }

  // Step 4: Queue course notifications for all enrolled learners
  console.log(`📲 Queuing notifications for course "${course.name}" to ${learnersToNotify.length} learners.`);
  // Add job to queue for each learner
  for (const to of learnersToNotify) {
    addJobToQueue(notificationQueue, 'sendNotification', { phoneNumber: to, courseData, course });
  }

  // Step 5: Schedule automated lesson delivery
  // This creates cron jobs to send lessons at specified times instead of immediately
  const scheduleLessonsResponse = await scheduleLessons(course.id, learnersToNotify, scheduleTime, startDate, frequency);

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
  let correctAnswer = null; // Will store correct answer if this is a quiz response

  // Find the learner by their phone number
  const learner = await prisma.learner.findFirst({ where: { number: phoneNumber } });
  if (!learner) return { error: "Learner not found" }; // Return error if learner doesn't exist

  // Find the course with lesson count for progress calculation
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { _count: { select: { lessons: true } } } // Get total lesson count
  });
  if (!course) return { error: "Course not found" }; // Return error if course doesn't exist

  // Find the lesson with quiz count for progress calculation
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      quiz: true // Include the quiz if it exists
    }
  });
  if (!lesson) return { error: "Lesson not found" }; // Return error if lesson doesn't exist

  // Get existing progress record or create new one
  let courseProgress = await prisma.courseProgress.findUnique({
    where: { learnerId_courseId: { learnerId: learner.id, courseId } } // Composite key lookup
  });

  // Get existing lesson progress record or create new one
  let lessonProgress = await prisma.lessonProgress.findUnique({
    where: { learnerId_lessonId: { learnerId: learner.id, lessonId } } // Composite key lookup
  });

  // Create initial progress record if none exists
  if (!courseProgress) {
    courseProgress = await prisma.courseProgress.create({
      data: { learnerId: learner.id, courseId } // Create with default values
    });
  }

  // Create lesson progress if it doesn't exist
  if (!lessonProgress) {
    lessonProgress = await prisma.lessonProgress.create({
      data: { learnerId: learner.id, lessonId } // Create with default values
    });
  }

  // Context for AI feedback (if needed)
  let aiQuizContext = null;


  // Handle quiz answer submission
  if (quizReply && lessonId) {
    // Find the quiz for this lesson
    const quiz = await prisma.quiz.findUnique({
      where: { lessonId: lessonId }
    });

    if (quiz) {
      // Check if the answer is correct
      if (quizReply === quiz.correctOption || 
          (quiz.correctOption && quizReply === quiz.correctOption.substring(0, 22) + '..')) {

        // Update quiz score by adding percentage points
        courseProgress = await prisma.courseProgress.update({
          where: { id: courseProgress.id },
          data: {
            quizScore: Math.round(
              ((courseProgress.quizScore || 0) + (100 / course.totalQuizzes)) // Add points based on total quizzes in course
            )
          }
        });

        // Update lesson progress
        lessonProgress = await prisma.lessonProgress.update({
          where: { id: lessonProgress.id },
          data: {
            quizScore: 100, // Lesson quiz score is 100% since each lesson has at most 1 quiz
            isCompleted: true, // Mark lesson as completed
            completedAt: new Date() // Set completion timestamp
          }
        });
      } else { //User's answer is wrong
        // Update quiz score by adding percentage points
        lessonProgress = await prisma.lessonProgress.update({
          where: { id: lessonProgress.id },
          data: {
            quizScore: 0, // Lesson quiz score is 0% since each lesson has at most 1 quiz
            isCompleted: true, // Mark lesson as completed
            completedAt: new Date() // Set completion timestamp
          }
        });
        correctAnswer = quiz.correctOption; // Return correct answer for confirmation
      }
      // Store learner reply to quiz
      lessonProgress = await prisma.lessonProgress.update({
        where: { id: lessonProgress.id },
        data: {
          quizReply: quizReply // Store learner reply to quiz
        }
      });
    }

    // Prepare AI context for quiz reply feedback (if needed)
    aiQuizContext = 'Course name: ' + course.name + '\nCourse description: ' + course.description +  '\nLesson title: ' + lesson.title + '\nLesson content: ' + lesson.content + '\nQuiz question: ' + lesson.quiz.question + '\nQuiz options: ' + lesson.quiz.options.join(', ') + '\nCorrect answer: ' + quiz.correctOption + '\nLearner answer: ' + quizReply;

  } 
  // Handle lesson completion (no quiz reply)
  else if (!quizReply) {
    // Update course completion progress
    courseProgress = await prisma.courseProgress.update({
      where: { id: courseProgress.id },
      data: {
        completedLessons: { increment: 1 }, // Increment completed lesson count
        progressPercent: Math.round(  
          ((courseProgress.completedLessons + 1) / course.totalLessons) * 100 // Calculate percentage
        ),
        isCompleted: courseProgress.completedLessons + 1 >= course.totalLessons, // Mark complete if all lessons done
        completedAt: courseProgress.completedLessons + 1 >= course.totalLessons 
          ? new Date() // Set completion timestamp if course finished
          : null
      }
    });

    // Update lesson completion progress
    lessonProgress = await prisma.lessonProgress.update({
      where: { id: lessonProgress.id },
      data: {
        isCompleted: true, // Mark lesson as completed
        completedAt: new Date() // Set completion timestamp
      }
    });
  }

  // Return updated progress and correct answer (if applicable)
  //console.log(courseProgress, lessonProgress, aiQuizContext, correctAnswer)
  return { courseProgress, lessonProgress, aiQuizContext, correctAnswer };
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
      prisma.lessonProgress.deleteMany({}), // Delete lesson progress records (references lessons)
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
    // Validate input
    if (!adminId || isNaN(Number(adminId))) {
      throw new Error('Valid admin ID is required');
    }

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
            progressPercent: true, // We only need the progress percentage
            isCompleted: true
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
      
      // Handle case where there's no progress data yet
      let averageProgress = 0;
      let completedEnrollments = 0;
      let inProgressEnrollments = 0;
      let activeEnrollments = 0;
      if (course.courseProgress && course.courseProgress.length > 0) {
        const totalProgress = course.courseProgress.reduce(
          (sum, progress) => sum + (progress.progressPercent || 0), 0
        );
        averageProgress = Math.round((totalProgress / course.courseProgress.length) * 100) / 100;

        course.courseProgress.forEach(progress=>{
          if (progress.isCompleted){
            completedEnrollments++;
          }else if (progress.progressPercent > 0){
            inProgressEnrollments++;
          }
        })

        activeEnrollments = inProgressEnrollments;
      }

      // Remove internal fields from the response
      const { courseProgress, _count,lessons, enrollments, messageContexts, ...courseData } = course;
      
      return {
        ...courseData,
        averageProgress,
        totalEnrollments,
        completedEnrollments,
        inProgressEnrollments,
        activeEnrollments
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
    throw new Error(`Failed to retrieve admin courses: ${error.message}`);
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
 * Unarchive a course by creating a new copy with specified status
 *
 * This function creates a new course by copying all data from an archived course:
 * 1. Finds the original course by ID
 * 2. Copies course metadata (name, description, coverImage, totalLessons, totalQuizzes)
 * 3. Copies all lessons and their associated quizzes
 * 4. Creates new course with new ID and specified status
 * 5. Returns the new course with all copied data
 *
 * @param {number} originalCourseId - The ID of the course to unarchive (copy from)
 * @param {string} newStatus - The status for the new course (DRAFT, PUBLISHED, ARCHIVED)
 * @returns {Promise<Object>} The new course with copied lessons and quizzes
 * @throws {Error} If original course not found or creation fails
 */
const unarchiveCourse = async (originalCourseId, newStatus) => {
  // Input validation
  if (!originalCourseId || isNaN(Number(originalCourseId))) {
    throw new Error('Valid original course ID is required');
  }

  if (!newStatus || !['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(newStatus)) {
    throw new Error('Valid status is required (DRAFT, PUBLISHED, or ARCHIVED)');
  }

  return await prisma.$transaction(async (tx) => {
    try {
      // 1. Find the original course with all its data
      const originalCourse = await tx.course.findUnique({
        where: { id: originalCourseId },
        include: {
          lessons: {
            include: {
              quiz: true // Include quizzes for each lesson
            },
            orderBy: {
              day: 'asc' // Maintain lesson order
            }
          }
        }
      });

      if (!originalCourse) {
        throw new Error('Original course not found');
      }

      console.log(`Unarchiving course: ${originalCourse.name} (ID: ${originalCourse.id}) -> New status: ${newStatus}`);

      // 2. Create the new course with copied data
      const baseName = originalCourse.name.replace(/\s*\(Kopya\s*\d*\)\s*$/, '');
      const existingCopies = await tx.course.count({
      where: {
        name: {
        startsWith: baseName,
        contains: 'Kopya'
          },
      adminId: originalCourse.adminId
        }
      });

const copyNumber = existingCopies > 0 ? ` ${existingCopies + 1}` : '';
const newCourseName = `${baseName} (Kopya${copyNumber})`;
      const newCourseData = {
        name: newCourseName,
        description: originalCourse.description,
        coverImage: originalCourse.coverImage,
        totalLessons: originalCourse.totalLessons,
        totalQuizzes: originalCourse.totalQuizzes,
        adminId: originalCourse.adminId,
        status: newStatus,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Set publishedAt if the new status is PUBLISHED
      if (newStatus === 'PUBLISHED') {
        newCourseData.publishedAt = new Date();
      }

      const newCourse = await tx.course.create({
        data: newCourseData
      });

      // 3. Copy all lessons and their quizzes
      const newLessons = [];
      const newQuizzes = [];

      for (const originalLesson of originalCourse.lessons) {
        // Create new lesson
        const newLesson = await tx.lesson.create({
          data: {
            title: originalLesson.title,
            content: originalLesson.content,
            day: originalLesson.day,
            document: originalLesson.document || null,
            media: originalLesson.media || null,
            externalLink: originalLesson.externalLink || null,
            courseId: newCourse.id,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });

        newLessons.push(newLesson);

        // Copy quizzes if they exist
        if (originalLesson.quiz) {
          // Validate quiz data before creating
          if (!originalLesson.quiz.question || !originalLesson.quiz.options || !originalLesson.quiz.correctOption) {
            console.warn(`Skipping quiz for lesson ${originalLesson.title} - missing required fields`);
          } else {
            try {
              const newQuiz = await tx.quiz.create({
                data: {
                  question: originalLesson.quiz.question,
                  options: originalLesson.quiz.options,
                  correctOption: originalLesson.quiz.correctOption,
                  lessonId: newLesson.id
                }
              });

              newQuizzes.push(newQuiz);
            } catch (quizError) {
              console.error(`Error creating quiz for lesson ${originalLesson.title}:`, quizError);
            }
          }
        }
      }

      console.log(`Successfully unarchived course. Created new course (ID: ${newCourse.id}) with ${newLessons.length} lessons and ${newQuizzes.length} quizzes`);

      // 4. Return the new course with all copied data
      return {
        ...newCourse,
        lessons: newLessons,
        quizzes: newQuizzes,
        originalCourseId: originalCourse.id
      };

    } catch (error) {
      console.error('Unarchive course error:', error);
      // Provide more specific error messages
      if (error.code === 'P2025') {
        throw new Error('Original course not found');
      }
      throw new Error(`Failed to unarchive course: ${error.message}`);
    }
  });
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
 * Updates a course and its related data
 * @param {number} courseId - ID of the course to update
 * @param {Object} courseData - Updated course data
 * @param {Array} [lessonsData=[]] - Updated lessons data
 * @param {Array} [numbers] - Array of phone numbers
 * @param {string} [scheduleTime] - Schedule time in HH:MM format
 * @param {string} [startDate] - Start date in YYYY-MM-DD format
 * @param {string} [frequency] - Frequency of lessons (daily, weekly, monthly)
 * @returns {Promise<Object>} - Updated course with lessons and quizzes
 * @throws {Error} If validation fails or update operation fails
 */
const updateCourse = async (courseId, courseData, lessonsData = [], numbers, scheduleTime, startDate, frequency) => {
  // Input validation
  if (!courseId || isNaN(Number(courseId))) {
      throw new Error('Valid course ID is required');
  }

  if (!courseData || typeof courseData !== 'object') {
      throw new Error('Course data is required');
  }

  if (lessonsData && !Array.isArray(lessonsData)) {
      throw new Error('Lessons data must be an array');
  }

  return await prisma.$transaction(async (tx) => {
      try {
          // 1. Verify the course exists and is accessible
          const existingCourse = await tx.course.findUnique({
              where: { id: courseId },
              include: { 
                  lessons: { 
                      include: { quiz: true } 
                  } 
              }
          });

          if (!existingCourse) {
              throw new Error('Course not found');
          }

          // 2. Validate status transitions
          if (courseData.status && existingCourse.status === 'PUBLISHED' && courseData.status !== 'PUBLISHED') {
              throw new Error('Cannot change status from PUBLISHED to DRAFT or ARCHIVED');
          }

          // 3. Get enrolled learners for notifications
          const enrollments = await tx.enrollment.findMany({
              where: { courseId },
              include: { learner: true }
          });
          
          const learnersToNotify = enrollments
              .filter(e => e.learner)
              .map(e => e.learner.number);

          // 4. Prepare course update data
          const updateData = {
              updatedAt: new Date()
          };

          // Only update fields that are provided and different from existing
          if (courseData.name !== undefined && courseData.name !== existingCourse.name) {
              updateData.name = courseData.name;
          }
          if (courseData.description !== undefined && courseData.description !== existingCourse.description) {
              updateData.description = courseData.description;
          }
          if (courseData.coverImage !== undefined && courseData.coverImage !== existingCourse.coverImage) {
              updateData.coverImage = courseData.coverImage;
          }
          if (courseData.status && courseData.status !== existingCourse.status) {
              updateData.status = courseData.status;
              if (courseData.status === 'PUBLISHED') {
                  updateData.publishedAt = new Date();
              }
          }

          // 5. Update course if there are changes
          let updatedCourse = existingCourse;
          if (Object.keys(updateData).length > 1) { // More than just updatedAt
              updatedCourse = await tx.course.update({
                  where: { id: courseId },
                  data: updateData,
                  include: { lessons: true }
              });
          }

          // If no lessons data provided, return early
          if (!lessonsData || lessonsData.length === 0) {
              return updatedCourse;
          }

          // 6. Validate lesson days are unique
          const lessonDays = new Set();
          for (const lessonData of lessonsData) {
              if (lessonDays.has(lessonData.day)) {
                  throw new Error(`Duplicate day number found: ${lessonData.day}. Each lesson must have a unique day.`);
              }
              lessonDays.add(lessonData.day);
          }

          // 7. Process lessons
          const existingLessons = existingCourse.lessons || [];
          const updatedLessons = [];
          const updatedQuizzes = [];

          for (const lessonData of lessonsData) {
              // Validate lesson data
              if (!lessonData.title || !lessonData.content || lessonData.day === undefined) {
                  throw new Error('Each lesson must have a title, content, and day number');
              }

              const existingLesson = existingLessons.find(lesson => lesson.id === lessonData.id);
              
              if (existingLesson) {
                  // Update existing lesson
                  const updatedLesson = await tx.lesson.update({
                      where: { id: existingLesson.id },
                      data: {
                          title: lessonData.title,
                          content: lessonData.content,
                          day: Number(lessonData.day),
                          document: lessonData.document || null,
                          media: lessonData.media || null,
                          externalLink: lessonData.externalLink || null,
                          updatedAt: new Date()
                      },
                      include: { quiz: true }
                  });
                  updatedLessons.push(updatedLesson);

                  // Handle quiz update
                  if (lessonData.quiz) {
                    let quizData;
                    try {
                      quizData = {
                        question: lessonData.quiz.question,
                        options: Array.isArray(lessonData.quiz.options)
                          ? lessonData.quiz.options
                          : JSON.parse(lessonData.quiz.options || '[]'),
                        correctOption: lessonData.quiz.correctOption
                      };
                    } catch (e) {
                      throw new Error('Invalid quiz options format. Must be a valid JSON array.');
                    }

                    if (existingLesson.quiz) {
                      // Update existing quiz
                      const updatedQuiz = await tx.quiz.update({
                        where: { id: existingLesson.quiz.id },
                        data: quizData
                      });
                      updatedQuizzes.push(updatedQuiz);
                    } else {
                      // Create new quiz
                      const newQuiz = await tx.quiz.create({
                        data: {
                          ...quizData,
                          lessonId: existingLesson.id
                        }
                      });
                      updatedQuizzes.push(newQuiz);
                    }
                  } else if (existingLesson.quiz) {
                    // Remove existing quiz if not in update
                    await tx.quiz.delete({ where: { id: existingLesson.quiz.id } });
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

          // 8. Clean up deleted lessons and their related data
          const updatedLessonIds = updatedLessons.map(lesson => lesson.id);
          const lessonsToDelete = existingLessons.filter(lesson => !updatedLessonIds.includes(lesson.id));
          
          if (lessonsToDelete.length > 0) {
              const lessonIdsToDelete = lessonsToDelete.map(lesson => lesson.id);
              
              // Delete related records in correct order
              await tx.quiz.deleteMany({
                  where: { lessonId: { in: lessonIdsToDelete } }
              });

              await tx.lessonProgress.deleteMany({
                  where: { lessonId: { in: lessonIdsToDelete } }
              });

              await tx.lesson.deleteMany({
                  where: { id: { in: lessonIdsToDelete } }
              });
          }

          // 9. Prepare result
          const result = {
              ...updatedCourse,
              lessons: updatedLessons,
              quizzes: updatedQuizzes
          };

          // 10. Schedule notifications if published (outside transaction)
          if (updatedCourse.status === 'PUBLISHED' && learnersToNotify.length > 0) {
              // This will run after the transaction commits
              process.nextTick(async () => {
                  try {
                      const notificationResults = await Promise.all(learnersToNotify.map(to => 
                          addJobToQueue(notificationQueue, 'sendNotification', { 
                              phoneNumber: to, 
                              courseData: updatedCourse, 
                              course: updatedCourse 
                          })
                      ));
                      console.log(`✅ Queued ${notificationResults.length} notifications`);

                      await scheduleLessons(updatedCourse.id, numbers, scheduleTime, startDate, frequency);
                  } catch (error) {
                      console.error('❌ Failed to queue notifications or schedule lessons:', error.message);
                  }
              });
          }

          return result;

      } catch (error) {
          console.error('Update course transaction error:', error);
          if (error.code === 'P2025') {
              throw new Error('Course not found or you do not have permission to update it');
          }
          throw new Error(`Failed to update course: ${error.message}`);
      }
  });
};

/**
 * Delete a course and all its related data
 * 
 * This function performs a cascading delete of a course and all its related data:
 * 1. Message contexts
 * 2. Course progress records
 * 3. Enrollments
 * 4. Quizzes
 * 5. Lessons
 * 6. The course itself
 * 
 * @param {number} courseId - The ID of the course to delete
 * @param {number} adminId - The ID of the admin requesting deletion
 * @returns {Promise<Object>} The deleted course
 * @throws {Error} If course not found or admin is not authorized
 */
const deleteCourse = async (courseId) => {
    return await prisma.$transaction(async (tx) => {
        // First verify the course exists
        const course = await tx.course.findUnique({
            where: { id: courseId },
            select: { id: true }
        });

        if (!course) {
            throw new Error('Course not found');
        }

        // Delete GroupCourse associations first
        await tx.groupCourse.deleteMany({
            where: { courseId }
        });

        // Delete enrollments
        await tx.enrollment.deleteMany({
            where: { courseId }
        });

        // Delete course progress records
        await tx.courseProgress.deleteMany({
            where: { courseId }
        });

        // Get lesson IDs to delete their quizzes and progress
        const lessons = await tx.lesson.findMany({
            where: { courseId },
            include: { quiz: true }
            //select: { id: true }
        });
        const lessonIds = lessons.map(lesson => lesson.id);

        // Delete quizzes for these lessons
        if (lessonIds.length > 0) {
            // Delete all quizzes for these lessons
            for (const lesson of lessons) {
                if (lesson.quiz) {
                    await tx.quiz.delete({ where: { id: lesson.quiz.id } });
                }
            }

            // Delete lesson progress records
            await tx.lessonProgress.deleteMany({
                where: { lessonId: { in: lessonIds } }
            });
        }

        // Delete lessons
        await tx.lesson.deleteMany({
            where: { courseId }
        });

        // Finally, delete the course
        const deletedCourse = await tx.course.delete({
            where: { id: courseId }
        });

        return deletedCourse;
    });
};


/**
 * Get a single course by ID with its lessons and quizzes
 * @param {number} courseId - The ID of the course to retrieve
 * @returns {Promise<Object>} The course with its lessons and quizzes
 * @throws {Error} If course is not found or other error occurs
 */
const getCourseById = async (courseId) => {
  try {
      const course = await prisma.course.findUnique({
          where: { id: Number(courseId) },
          include: {
              lessons: {
                  include: {
                      quiz: true
                  },
                  orderBy: {
                      day: 'asc' // Order lessons by day
                  }
              },
              admin: {
                  select: {
                      id: true,
                      name: true,
                      email: true
                  }
              }
          }
      });

      if (!course) {
          throw new Error('Course not found');
      }

      return course;
  } catch (error) {
      console.error('Error fetching course:', error);
      throw new Error(error.message || 'Failed to fetch course');
  }
};


// Export all course service functions for use in other modules
module.exports = {
  createCourse, // Function to create complete courses with lessons, quizzes, and enrollments
  updateCourse, // Function to update existing draft courses
  deleteCourse, // Function to delete a course and all its related data
  updateCourseProgress, // Function to track learner progress through lessons and quizzes
  getAdminCourses,  // Function to get all courses for the logged-in admin
  getCoursesByStatus, // Function to get courses by status
  publishCourse, // Function to publish a draft course
  archiveCourse, // Function to archive a course
  unarchiveCourse, // Function to unarchive a course by creating a new copy
  deleteAllCourses, // Function to delete all course data (for testing/cleanup)
  scheduleLessons, // Function to schedule automated lesson delivery via cron jobs
  getCourseById // Function to get a single course by ID with its lessons and quizzes
}