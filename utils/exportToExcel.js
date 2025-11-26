// export-to-excel.js
const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function exportToExcel() {
    try {
        console.log('📊 Starting data export...');

        // Fetch all data from main tables
        const [admins, learners, courses, groups, enrollments, courseProgress, lessonProgress, lessons, quizzes, messages] = await Promise.all([
            prisma.admin.findMany({
                include: {
                    courses: {
                        select: { id: true, name: true }
                    },
                    groups: {
                        select: { id: true, name: true }
                    },
                    learners: {
                        select: { id: true, name: true, surname: true }
                    }
                }
            }),
            prisma.learner.findMany({
                include: {
                    admin: {
                        select: { id: true, name: true, surname: true }
                    },
                    enrollments: {
                        include: {
                            course: {
                                select: { id: true, name: true }
                            }
                        }
                    },
                    courseProgress: {
                        include: {
                            course: {
                                select: { id: true, name: true }
                            }
                        }
                    },
                    lessonProgress: {
                        include: {
                            lesson: {
                                select: { id: true, title: true, course: { select: { name: true } } }
                            }
                        }
                    },
                    groups: {
                        include: {
                            group: {
                                select: { id: true, name: true }
                            }
                        }
                    }
                }
            }),
            prisma.course.findMany({
                include: {
                    admin: {
                        select: { id: true, name: true, surname: true }
                    },
                    lessons: {
                        include: {
                            quiz: true
                        }
                    },
                    enrollments: {
                        include: {
                            learner: {
                                select: { id: true, name: true, surname: true }
                            }
                        }
                    },
                    courseProgress: {
                        include: {
                            learner: {
                                select: { id: true, name: true, surname: true }
                            }
                        }
                    },
                    groups: {
                        include: {
                            group: {
                                select: { id: true, name: true }
                            }
                        }
                    }
                }
            }),
            prisma.group.findMany({
                include: {
                    admin: {
                        select: { id: true, name: true, surname: true }
                    },
                    members: {
                        include: {
                            learner: {
                                select: { id: true, name: true, surname: true }
                            }
                        }
                    },
                    courses: {
                        include: {
                            course: {
                                select: { id: true, name: true }
                            }
                        }
                    }
                }
            }),
            prisma.enrollment.findMany({
                include: {
                    learner: {
                        select: { id: true, name: true, surname: true }
                    },
                    course: {
                        select: { id: true, name: true }
                    }
                }
            }),
            prisma.courseProgress.findMany({
                include: {
                    learner: {
                        select: { id: true, name: true, surname: true }
                    },
                    course: {
                        select: { id: true, name: true }
                    }
                }
            }),
            prisma.lessonProgress.findMany({
                include: {
                    learner: {
                        select: { id: true, name: true, surname: true }
                    },
                    lesson: {
                        include: {
                            course: {
                                select: { id: true, name: true }
                            }
                        }
                    }
                }
            }),
            prisma.lesson.findMany({
                include: {
                    course: {
                        select: { id: true, name: true }
                    },
                    quiz: true
                }
            }),
            prisma.quiz.findMany({
                include: {
                    lesson: {
                        include: {
                            course: {
                                select: { id: true, name: true }
                            }
                        }
                    }
                }
            }),
            prisma.message.findMany({
                  select: {
                        from: true,
                        to: true,
                        body: true,
                        type: true,
                        direction: true,
                        status: true,
                        createdAt: true,
                        messageContexts: {
                              select: {
                              course: { select: { name: true } },
                              lesson: { select: { title: true } },
                              quiz: { select: { question: true } }
                              }
                        }
                  },
                  take: 1000,
                  orderBy: {
                        createdAt: 'desc'
                  }
            })
        ]);

        console.log('✅ Data fetched successfully');

        // Create Excel workbook
        const workbook = XLSX.utils.book_new();

        // Helper function to format data for Excel
        const formatForExcel = (data, title) => {
            if (!data || data.length === 0) return [];

            // Get all unique keys from the data
            const allKeys = new Set();
            data.forEach(item => {
                Object.keys(item).forEach(key => {
                    if (typeof item[key] === 'object' && item[key] !== null) {
                        // Handle nested objects (like relations)
                        Object.keys(item[key]).forEach(nestedKey => {
                            allKeys.add(`${key}_${nestedKey}`);
                        });
                    } else {
                        allKeys.add(key);
                    }
                });
            });

            return data.map(item => {
                const formattedItem = {};
                allKeys.forEach(key => {
                    if (key.includes('_')) {
                        // Handle nested object properties
                        const [objKey, nestedKey] = key.split('_');
                        if (item[objKey] && typeof item[objKey] === 'object') {
                            if (Array.isArray(item[objKey])) {
                                // For arrays, join them as comma-separated strings
                                formattedItem[key] = item[objKey].map(n => n[nestedKey] || '').join(', ');
                            } else {
                                formattedItem[key] = item[objKey][nestedKey] || '';
                            }
                        } else {
                            formattedItem[key] = '';
                        }
                    } else {
                        // Handle direct properties
                        if (Array.isArray(item[key])) {
                            formattedItem[key] = item[key].join(', ');
                        } else if (typeof item[key] === 'object' && item[key] !== null) {
                            formattedItem[key] = JSON.stringify(item[key]);
                        } else {
                            formattedItem[key] = item[key] || '';
                        }
                    }
                });
                return formattedItem;
            });
        };

        // Add sheets for each table
        const sheets = [
            { name: 'Admins', data: admins },
            { name: 'Learners', data: learners },
            { name: 'Courses', data: courses },
            { name: 'Groups', data: groups },
            { name: 'Enrollments', data: enrollments },
            { name: 'CourseProgress', data: courseProgress },
            { name: 'LessonProgress', data: lessonProgress },
            { name: 'Lessons', data: lessons },
            { name: 'Quizzes', data: quizzes },
            { name: 'Messages', data: messages }
        ];

        sheets.forEach(({ name, data }) => {
            if (data && data.length > 0) {
                const formattedData = formatForExcel(data, name);
                const worksheet = XLSX.utils.json_to_sheet(formattedData);
                XLSX.utils.book_append_sheet(workbook, worksheet, name);
                console.log(`✅ Added ${name} sheet (${data.length} records)`);
            }
        });

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `whatsapp-elearning-export-${timestamp}.xlsx`;

        // Write to file
        XLSX.writeFile(workbook, filename);

        console.log(`🎉 Export completed! File saved as: ${filename}`);
        console.log(`📊 Summary:`);
        sheets.forEach(({ name, data }) => {
            if (data && data.length > 0) {
                console.log(`   • ${name}: ${data.length} records`);
            }
        });

    } catch (error) {
        console.error('❌ Export failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the export
exportToExcel().catch(console.error);
