const { format } = require("date-fns");
const { PrismaClient } = require('../generated/prisma');
const { withAccelerate } = require('@prisma/extension-accelerate'); 
const { sendTextMessage } = require('./whatsappService');

const prisma = new PrismaClient().$extends(withAccelerate())

const formattedDate = (timestamp) => {
    return format(
        new Date(parseInt(timestamp) * 1000),
        "MMMM dd, yyyy 'at' hh:mm a"
    );
};


const verifyWebhook = async (request) => {
    try {
        const mode = request.query['hub.mode'];
        const challenge = request.query['hub.challenge'];
        const token = request.query['hub.verify_token'];

        console.log('Webhook verify request:', { mode, challenge, token });

        if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
            console.log('Webhook verified successfully');
            return challenge;
        }
        console.log('Webhook verification failed');
        return null;
    } catch (error) {
        console.error('Webhook verification error:', error);
        throw error; // throw instead of return
    }
}

const handleMessageStatuses = async (statuses) => {
    try {
        // Validate required fields
        if (!statuses || !statuses.id || !statuses.status) {
            console.warn('Invalid status data received:', statuses);
            return null;
        }

        const {id, status, timestamp, recipient_id} = statuses;
        
        const result = {
            message_id: id,
            status: status,
            recipient_id: recipient_id,
            time: timestamp ? formattedDate(timestamp) : 'Unknown'
        }

        try {
            // Update the message status using messageId
            await prisma.message.updateMany({
                where: { messageId: id },
                data: {
                    status: status,
                }
            });
            
        } catch (error) {
            console.error('Failed to update message status:', error);
        }

        return result;
    } catch (error) {
        console.error('Webhook message status error:', error);
        return null;
    }
}

const handleIncomingMessages = async (messages, name) => {
    const { from, id, timestamp, type } = messages;
    let messageBody = '';
    let extraData = {};

    try {
        // Handle different message types
        switch (type) {
            case 'button':
                messageBody = messages.button?.text || '';
                extraData = {
                    from: messages.context?.from,
                    context: messages.context?.id,
                }
                await logMessageAndContext(id, from, messageBody, type, timestamp, messages.context.id);
                await handleQuickReply(from, messageBody, messages.context);
                break;
            case 'text':
                messageBody = messages.text?.body || '';
                //await logMessageAndContext(id, from, messageBody, type, timestamp, courseId, lessonId, quizId);
                break;
            case 'image':
                messageBody = '[Image]';
                extraData = {
                    imageId: messages.image?.id,
                    mimeType: messages.image?.mime_type,
                    caption: messages.image?.caption
                };
                //await logMessageAndContext(id, from, messageBody, type, timestamp, courseId, lessonId, quizId);
                break;
            case 'document':
                messageBody = '[Document]';
                extraData = {
                    documentId: messages.document?.id,
                    filename: messages.document?.filename,
                    mimeType: messages.document?.mime_type
                };
                //await logMessageAndContext(id, from, messageBody, type, timestamp, courseId, lessonId, quizId);
                break;
            case 'interactive':
                messageBody = messages.interactive?.button_reply.title;
                extraData = {
                    interactiveType: messages.interactive?.type,
                    buttonReply: messages.interactive?.button_reply,
                    listReply: messages.interactive?.list_reply
                };
                //await logMessageAndContext(id, from, messageBody, type, timestamp, courseId, lessonId, quizId);
                //await handleQuizReply(from, messageBody);
                break;
            default:
                messageBody = '[Unsupported message type]';
        }

        const result = {
            name: name,
            number: from,
            message_id: id,
            type: type,
            message_body: messageBody,
            ...extraData,
            timestamp: formattedDate(timestamp)
        };

        try {
            await prisma.message.create({
                data: {
                    messageId: id,
                    from: from,
                    to: "zenolearn",
                    body: messageBody,
                    type: type,
                    direction: "incoming",
                    status: "received",
                    localtime: new Date(parseInt(timestamp) * 1000 + (3 * 60 * 60 * 1000)) //UTC +3
                }
            });
            // Note: MessageContext is only created for outgoing messages, not incoming ones
            // Incoming messages don't need context since they are responses to our messages
        } catch (error) {
            throw new Error('Failed to log incoming message');
        }

        return result;
    } catch (error) {
        console.error('Webhook receiving message error:', error);
        throw error;
    }
};



const handleQuickReply = async (messageBody, context, from) => {
    // context.id contains the message ID being replied to
    const repliedToMessageId = context.id;
        
    // Find the original message context
    const messageContext = await prisma.messageContext.findUnique({
        where: { messageId: repliedToMessageId },
        include: { course: true }
    });
    
    if (messageContext) {
        // Now you know which course/lesson this is about
        const { courseId } = messageContext;
        
        if(messageBody === "Start"){
            try {
                const setActiveLearner = await prisma.learner.updateMany({
                    where: { number: from },
                    data: { active: true }
                });
                if (!setActiveLearner) {
                    throw new Error('Learner not found');
                }
            } catch (error) {
                console.error('Failed to find learner:', error);
            }  
            await sendTextMessage(from, "Thank you for enrolling in our course. We will notify you when the course starts.");
        }
        else if (messageBody === "Done") {
            await updateCourseProgress(from, courseId);
            await sendTextMessage(from, "Great job completing this lesson! 🎉");
        }
    }
}

const updateCourseProgress = async (phoneNumber, courseId) => {
    // Find the learner
    const learner = await prisma.learner.findUnique({
      where: { number: phoneNumber }
    });
    
    if (!learner) return;
    
    // Get or create course progress
    let progress = await prisma.courseProgress.findUnique({
      where: {
        learnerId_courseId: {
          learnerId: learner.id,
          courseId: courseId
        }
      }
    });
    
    if (!progress) {
      // Create new progress if it doesn't exist
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        include: { _count: { select: { lessons: true } } }
      });
      
      progress = await prisma.courseProgress.create({
        data: {
          learnerId: learner.id,
          courseId: courseId,
          totalLessons: course._count.lessons,
          completedLessons: 1,
          progressPercent: Math.round((1 / course._count.lessons) * 100)
        }
      });
    } else {
      // Update existing progress
      progress = await prisma.courseProgress.update({
        where: { id: progress.id },
        data: {
          completedLessons: { increment: 1 },
          progressPercent: Math.round(
            ((progress.completedLessons + 1) / progress.totalLessons) * 100
          ),
          isCompleted: progress.completedLessons + 1 >= progress.totalLessons,
          completedAt: progress.completedLessons + 1 >= progress.totalLessons 
            ? new Date() 
            : null
        }
      });
    }
    
    return progress;
}


const logMessageAndContext = async(id, from, messageBody, type, timestamp, contextMessageId) => {
    try {
        await prisma.message.create({
            data: {
                messageId: id,
                from: from,
                to: "zenolearn",
                body: messageBody,
                type: type,
                direction: "incoming",
                status: "received",
                localtime: new Date(parseInt(timestamp) * 1000 + (3 * 60 * 60 * 1000)) //UTC +3
            }
        });

        // Find the original message context using the contextMessageId
        const originalMessageContext = await prisma.messageContext.findUnique({
            where: { messageId: contextMessageId }
        });
        
        if (!originalMessageContext) {
            console.warn('Original message context not found for:', contextMessageId);
            return; // Don't throw error, just log warning
        }    
        
        const { courseId, lessonId, quizId } = originalMessageContext;
        
        // Store the message context for this reply
        await prisma.messageContext.create({
            data: {
                messageId: id,
                phoneNumber: from,
                courseId: courseId,
                lessonId: lessonId,
                quizId: quizId,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Expires in 7 days
            }
        });
    } catch (error) {
        console.error('Failed to log incoming message:', error);
        throw new Error('Failed to log incoming message');
    }
}

const deleteAllMessages = async () => {
    try {
        return prisma.message.deleteMany({});
    } catch (error) {
        throw new Error('Failed to delete messages');
    }
}


// Function to store message context for outgoing messages
const storeMessageContext = async (phoneNumber, messageId, courseId, lessonId = null, quizId = null) => {
    try {
        await prisma.messageContext.create({
            data: {
                messageId: messageId,
                phoneNumber: phoneNumber,
                courseId: courseId,
                lessonId: lessonId,
                quizId: quizId,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Expires in 7 days
            }
        });
        console.log(`✅ Message context stored for ${messageId}`);
    } catch (error) {
        console.error('Failed to store message context:', error);
        throw error;
    }
};

module.exports = {
    verifyWebhook,
    handleIncomingMessages,
    handleMessageStatuses,
    deleteAllMessages,
    storeMessageContext
}