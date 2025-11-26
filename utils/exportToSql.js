// export-to-sql.js
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function exportToSQL() {
    try {
        console.log('📊 Starting SQL export...');

        // Fetch all data from main tables
        const [admins, learners, courses, groups, enrollments, courseProgress, lessonProgress, lessons, quizzes, messages] = await Promise.all([
            prisma.admin.findMany({
                include: {
                    courses: true,
                    groups: true,
                    learners: true
                }
            }),
            prisma.learner.findMany({
                include: {
                    admin: true,
                    enrollments: { include: { course: true } },
                    courseProgress: { include: { course: true } },
                    lessonProgress: { include: { lesson: { include: { course: true } } } },
                    groups: { include: { group: true } }
                }
            }),
            prisma.course.findMany({
                include: {
                    admin: true,
                    lessons: { include: { quiz: true } },
                    enrollments: { include: { learner: true } },
                    courseProgress: { include: { learner: true } },
                    groups: { include: { group: true } }
                }
            }),
            prisma.group.findMany({
                include: {
                    admin: true,
                    members: { include: { learner: true } },
                    courses: { include: { course: true } }
                }
            }),
            prisma.enrollment.findMany({
                include: { learner: true, course: true }
            }),
            prisma.courseProgress.findMany({
                include: { learner: true, course: true }
            }),
            prisma.lessonProgress.findMany({
                include: { learner: true, lesson: { include: { course: true } } }
            }),
            prisma.lesson.findMany({
                include: { course: true, quiz: true }
            }),
            prisma.quiz.findMany({
                include: { lesson: { include: { course: true } } }
            }),
            prisma.message.findMany({
                include: {
                    messageContexts: {
                        include: {
                            course: true,
                            lesson: true,
                            quiz: true
                        }
                    }
                },
                take: 1000,
                orderBy: { createdAt: 'desc' }
            })
        ]);

        console.log('✅ Data fetched successfully');

        // Generate SQL statements
        let sqlStatements = [];

        // Helper function to escape SQL strings
        const escapeSql = (str) => {
            if (str === null || str === undefined) return 'NULL';
            return `'${String(str).replace(/'/g, "''")}'`;
        };

        // Helper function to format array/object values
        const formatValue = (value) => {
            if (value === null || value === undefined) return 'NULL';
            if (typeof value === 'boolean') return value ? 'true' : 'false';
            if (typeof value === 'number') return value;
            if (Array.isArray(value)) return `'${JSON.stringify(value)}'`;
            if (typeof value === 'object') return `'${JSON.stringify(value)}'`;
            return escapeSql(value);
        };

        // Export Admins
        if (admins.length > 0) {
            sqlStatements.push('-- Export Admin Users');
            admins.forEach(admin => {
                sqlStatements.push(`INSERT INTO "Admin" (id, name, surname, password, email, number, department, company, "createdAt", "updatedAt", "lastLogin") VALUES (${admin.id}, ${escapeSql(admin.name)}, ${escapeSql(admin.surname)}, ${escapeSql(admin.password)}, ${escapeSql(admin.email)}, ${escapeSql(admin.number)}, ${escapeSql(admin.department)}, ${escapeSql(admin.company)}, '${admin.createdAt.toISOString()}', '${admin.updatedAt.toISOString()}', ${admin.lastLogin ? `'${admin.lastLogin.toISOString()}'` : 'NULL'});`);
            });
        }

        // Export Learners
        if (learners.length > 0) {
            sqlStatements.push('\n-- Export Learners');
            learners.forEach(learner => {
                sqlStatements.push(`INSERT INTO "Learner" (id, active, name, surname, email, number, "adminId", "createdAt", "updatedAt") VALUES (${learner.id}, ${learner.active}, ${escapeSql(learner.name)}, ${escapeSql(learner.surname)}, ${escapeSql(learner.email)}, ${escapeSql(learner.number)}, ${learner.adminId || 'NULL'}, '${learner.createdAt.toISOString()}', '${learner.updatedAt.toISOString()}');`);
            });
        }

        // Export Courses
        if (courses.length > 0) {
            sqlStatements.push('\n-- Export Courses');
            courses.forEach(course => {
                sqlStatements.push(`INSERT INTO "Course" (id, name, description, "coverImage", status, "publishedAt", "adminId", "totalLessons", "totalQuizzes", "createdAt", "updatedAt") VALUES (${course.id}, ${escapeSql(course.name)}, ${escapeSql(course.description)}, ${escapeSql(course.coverImage)}, ${escapeSql(course.status)}, ${course.publishedAt ? `'${course.publishedAt.toISOString()}'` : 'NULL'}, ${course.adminId}, ${course.totalLessons}, ${course.totalQuizzes}, '${course.createdAt.toISOString()}', '${course.updatedAt.toISOString()}');`);
            });
        }

        // Export Groups
        if (groups.length > 0) {
            sqlStatements.push('\n-- Export Groups');
            groups.forEach(group => {
                sqlStatements.push(`INSERT INTO "Group" (id, name, "adminId", "createdAt", "updatedAt") VALUES (${group.id}, ${escapeSql(group.name)}, ${group.adminId}, '${group.createdAt.toISOString()}', '${group.updatedAt.toISOString()}');`);
            });
        }

        // Export Enrollments
        if (enrollments.length > 0) {
            sqlStatements.push('\n-- Export Enrollments');
            enrollments.forEach(enrollment => {
                sqlStatements.push(`INSERT INTO "Enrollment" (id, "learnerId", "courseId", "enrolledAt") VALUES (${enrollment.id}, ${enrollment.learnerId}, ${enrollment.courseId}, '${enrollment.enrolledAt.toISOString()}');`);
            });
        }

        // Export Course Progress
        if (courseProgress.length > 0) {
            sqlStatements.push('\n-- Export Course Progress');
            courseProgress.forEach(progress => {
                sqlStatements.push(`INSERT INTO "CourseProgress" (id, "learnerId", "courseId", "completedLessons", "progressPercent", "quizScore", "startedAt", "lastActivityAt", "isCompleted", "completedAt") VALUES (${progress.id}, ${progress.learnerId}, ${progress.courseId}, ${progress.completedLessons}, ${progress.progressPercent}, ${progress.quizScore}, '${progress.startedAt.toISOString()}', '${progress.lastActivityAt.toISOString()}', ${progress.isCompleted}, ${progress.completedAt ? `'${progress.completedAt.toISOString()}'` : 'NULL'});`);
            });
        }

        // Export Lesson Progress
        if (lessonProgress.length > 0) {
            sqlStatements.push('\n-- Export Lesson Progress');
            lessonProgress.forEach(progress => {
                sqlStatements.push(`INSERT INTO "LessonProgress" (id, "learnerId", "lessonId", "isCompleted", "completedAt", "quizScore", "quizReply", "startedAt", "lastActivityAt") VALUES (${progress.id}, ${progress.learnerId}, ${progress.lessonId}, ${progress.isCompleted}, ${progress.completedAt ? `'${progress.completedAt.toISOString()}'` : 'NULL'}, ${progress.quizScore || 'NULL'}, ${escapeSql(progress.quizReply)}, '${progress.startedAt.toISOString()}', '${progress.lastActivityAt.toISOString()}');`);
            });
        }

        // Export Lessons
        if (lessons.length > 0) {
            sqlStatements.push('\n-- Export Lessons');
            lessons.forEach(lesson => {
                sqlStatements.push(`INSERT INTO "Lesson" (id, title, content, "courseId", day, document, media, "externalLink", "createdAt", "updatedAt") VALUES (${lesson.id}, ${escapeSql(lesson.title)}, ${escapeSql(lesson.content)}, ${lesson.courseId}, ${lesson.day}, ${escapeSql(lesson.document)}, ${escapeSql(lesson.media)}, ${escapeSql(lesson.externalLink)}, '${lesson.createdAt.toISOString()}', '${lesson.updatedAt.toISOString()}');`);
            });
        }

        // Export Quizzes
        if (quizzes.length > 0) {
            sqlStatements.push('\n-- Export Quizzes');
            quizzes.forEach(quiz => {
                sqlStatements.push(`INSERT INTO "Quiz" (id, "lessonId", question, options, "correctOption") VALUES (${quiz.id}, ${quiz.lessonId}, ${escapeSql(quiz.question)}, '${JSON.stringify(quiz.options)}', ${escapeSql(quiz.correctOption)});`);
            });
        }

        // Export Messages (limited to prevent huge files)
        if (messages.length > 0) {
            sqlStatements.push('\n-- Export Messages (Latest 1000)');
            messages.forEach(message => {
                sqlStatements.push(`INSERT INTO "Message" (id, "messageId", "from", "to", body, type, direction, status, localtime, "createdAt", "updatedAt") VALUES (${message.id}, ${escapeSql(message.messageId)}, ${escapeSql(message.from)}, ${escapeSql(message.to)}, ${escapeSql(message.body)}, ${escapeSql(message.type)}, ${escapeSql(message.direction)}, ${escapeSql(message.status)}, ${message.localtime ? `'${message.localtime.toISOString()}'` : 'NULL'}, '${message.createdAt.toISOString()}', '${message.updatedAt.toISOString()}');`);
            });
        }

        // Add summary
        sqlStatements.push(`\n-- Export Summary:`);
        sqlStatements.push(`-- Admins: ${admins.length}`);
        sqlStatements.push(`-- Learners: ${learners.length}`);
        sqlStatements.push(`-- Courses: ${courses.length}`);
        sqlStatements.push(`-- Groups: ${groups.length}`);
        sqlStatements.push(`-- Enrollments: ${enrollments.length}`);
        sqlStatements.push(`-- Course Progress: ${courseProgress.length}`);
        sqlStatements.push(`-- Lesson Progress: ${lessonProgress.length}`);
        sqlStatements.push(`-- Lessons: ${lessons.length}`);
        sqlStatements.push(`-- Quizzes: ${quizzes.length}`);
        sqlStatements.push(`-- Messages: ${messages.length}`);
        sqlStatements.push(`-- Exported at: ${new Date().toISOString()}`);

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `whatsapp-elearning-sql-export-${timestamp}.sql`;

        // Write to file
        fs.writeFileSync(filename, sqlStatements.join('\n'));

        console.log(`🎉 SQL export completed! File saved as: ${filename}`);
        console.log(`📊 Summary:`);
        console.log(`   • Admins: ${admins.length} records`);
        console.log(`   • Learners: ${learners.length} records`);
        console.log(`   • Courses: ${courses.length} records`);
        console.log(`   • Groups: ${groups.length} records`);
        console.log(`   • Enrollments: ${enrollments.length} records`);
        console.log(`   • Course Progress: ${courseProgress.length} records`);
        console.log(`   • Lesson Progress: ${lessonProgress.length} records`);
        console.log(`   • Lessons: ${lessons.length} records`);
        console.log(`   • Quizzes: ${quizzes.length} records`);
        console.log(`   • Messages: ${messages.length} records`);

    } catch (error) {
        console.error('❌ SQL export failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the export
exportToSQL().catch(console.error);
