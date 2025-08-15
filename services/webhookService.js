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
                await logMessageAndContext(id, from, messageBody, type, timestamp, messages.context?.id);
                await handleQuickReply(from, messageBody, messages.context);
                break;
            case 'text':
                messageBody = messages.text?.body || '';
                await logMessageAndContext(id, from, messageBody, type, timestamp, messages.context?.id);
                break;
            case 'image':
                messageBody = '[Image]';
                extraData = {
                    imageId: messages.image?.id,
                    mimeType: messages.image?.mime_type,
                    caption: messages.image?.caption
                };
                await logMessageAndContext(id, from, messageBody, type, timestamp, messages.context?.id);

                break;
            case 'document':
                messageBody = '[Document]';
                extraData = {
                    documentId: messages.document?.id,
                    filename: messages.document?.filename,
                    mimeType: messages.document?.mime_type
                };
                await logMessageAndContext(id, from, messageBody, type, timestamp, messages.context?.id);
                break;
            case 'interactive':
                messageBody = messages.interactive?.list_reply?.title || messages.interactive?.button_reply?.title;
                extraData = {
                    interactiveType: messages.interactive?.type,
                    reply: messages.interactive?.list_reply || messages.interactive?.button_reply
                };
                await logMessageAndContext(id, from, messageBody, type, timestamp, messages.context?.id);
                await handleQuickReply(from, messageBody, messages.context);
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

        return result;
    } catch (error) {
        console.error('Webhook receiving message error:', error);
    }
};



const handleQuickReply = async (from, messageBody, context) => {
    const { updateCourseProgress } = require('./courseService');

    // context.id contains the message ID being replied to
    const repliedToMessageId = context.id;
        
    // Find the original message context
    const messageContext = await prisma.messageContext.findUnique({
        where: { messageId: repliedToMessageId },
        include: { course: true }
    });
    
    if (messageContext) {
        // Now you know which course/lesson this is about
        const { courseId, lessonId } = messageContext;
        
        if(messageBody === "Start"){
            try {
                const setActiveLearner = await prisma.learner.updateMany({
                    where: { number: from },
                    data: { active: true }
                });
                
                if (setActiveLearner.count === 0) {
                    console.warn(`⚠️  No learner found with number: ${from}`);
                    await sendTextMessage(from, "Sorry, we couldn't find your registration. Please contact support.");
                    return;
                } else {
                    console.log(`✅ Activated learner with number: ${from} (${setActiveLearner.count} record(s) updated)`);
                }
            } catch (error) {
                console.error('Failed to activate learner:', error);
                await sendTextMessage(from, "Sorry, there was an error activating your account. Please try again.😞");
                return;
            }  
            await sendTextMessage(from, "Thank you for enrolling in our course. We will notify you when the course starts.🙏");
        }
        else if (messageBody === "Done") {
            await updateCourseProgress(from, courseId, lessonId);
            await sendTextMessage(from, "Great job completing this lesson! 🎉");
        } 
        else {
            const {progress, correct} = await updateCourseProgress(from, courseId, lessonId, messageBody);
            if (correct !== null) {
                await sendTextMessage(from, "Correct! Keep it up! 👏🎉");
            } else {
                await sendTextMessage(from,`Wrong ❌, the correct answer is ${correct}. Better luck next time!`);
            }
        }
    }
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

        // If this message is a reply to another message, find the original context
        if (contextMessageId) {
            // Find the original message context using the contextMessageId
            const originalMessageContexts = await prisma.messageContext.findMany({
                where: { messageId: contextMessageId, phoneNumber: from },
                include: {
                    course: true,
                    lesson: true,
                    quiz: true
                },
                take: 1
            });
            
            if (originalMessageContexts && originalMessageContexts.length > 0) {
                const originalContext = originalMessageContexts[0];
                const { courseId, lessonId, quizId, course, lesson, quiz } = originalContext;
                
                // Log the context information
                console.log(`💬 Reply received for:`);
                console.log(`   Course: ${course?.name || 'Unknown'} (ID: ${courseId})`);
                if (lesson) console.log(`   Lesson: ${lesson?.title} (ID: ${lessonId})`);
                if (quiz) console.log(`   Quiz: ${quiz?.question.substring(0, 50)}... (ID: ${quizId})`);
                console.log(`   From: ${from}`);
                console.log(`   Message: ${messageBody}`);
                
                // Store the message context for this reply
                /*
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
                */
                
                // Return the context information for further processing
                return {
                    hasContext: true,
                    courseId,
                    lessonId,
                    quizId,
                    course,
                    lesson,
                    quiz
                };
            } else {
                console.warn('⚠️  Original message context not found for:', contextMessageId);
                return { hasContext: false };
            }
        } else {
            console.log('💬 Message is not a reply to any previous message');
            return { hasContext: false };
        }
    } catch (error) {
        console.error('Failed to log incoming message:', error);
    }
}

const deleteAllMessages = async () => {
    try {
        // Delete MessageContext records first to avoid foreign key constraint violations
        await prisma.messageContext.deleteMany({});
        
        // Then delete all messages
        const result = await prisma.message.deleteMany({});
        
        console.log(`✅ Deleted ${result.count} messages and their contexts`);
        return result;
    } catch (error) {
        console.error('Failed to delete messages:', error);
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
    }
};

module.exports = {
    verifyWebhook,
    handleIncomingMessages,
    handleMessageStatuses,
    deleteAllMessages,
    storeMessageContext
}