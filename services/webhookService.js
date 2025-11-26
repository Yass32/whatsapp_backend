/**
 * Webhook Service Module
 * 
 * This module handles WhatsApp webhook operations including:
 * - Webhook verification for WhatsApp Business API
 * - Processing incoming messages from users
 * - Handling message status updates
 * - Managing quick reply interactions
 * - Storing message context for conversation tracking
 * 
 * @author Your Name
 * @version 1.0.0
 */

// Import required dependencies
const { format } = require("date-fns"); // Date formatting utility
const { PrismaClient } = require('@prisma/client'); // Database ORM client
const { withAccelerate } = require('@prisma/extension-accelerate'); // Prisma performance extension
const { sendTextMessage } = require('./whatsappService'); // WhatsApp messaging service
const { textQueue, addJobToQueue } = require('./queueService'); // Queue service to add text message jobs
const { generateAIResponse, generateAIQuizFeedback } = require('./aiService'); // AI response generation service

// Initialize Prisma client with acceleration for better performance
const prisma = new PrismaClient().$extends(withAccelerate())

/**
 * Format Unix timestamp to human-readable date string
 * 
 * @param {string|number} timestamp - Unix timestamp from WhatsApp API
 * @returns {string} Formatted date string in "Month DD, YYYY at HH:MM AM/PM" format
 */
const formattedDate = (timestamp) => {
    return format(
        new Date(parseInt(timestamp) * 1000), // Convert Unix timestamp to Date object
        "MMMM dd, yyyy 'at' hh:mm a" // Format: "January 15, 2024 at 10:30 AM"
    );
};


/**
 * Verify webhook subscription request from WhatsApp Business API
 * 
 * WhatsApp sends a GET request with verification parameters when setting up
 * a webhook endpoint. This function validates the request and returns the
 * challenge token if verification succeeds.
 * 
 * @param {Object} request - Express request object containing query parameters
 * @returns {string|null} Challenge token if verification succeeds, null otherwise
 * @throws {Error} If verification process encounters an error
 */
const verifyWebhook = async (request) => {
    try {
        // Extract verification parameters from query string
        const mode = request.query['hub.mode']; // Should be 'subscribe'
        const challenge = request.query['hub.challenge']; // Token to echo back
        const token = request.query['hub.verify_token']; // Our verification token

        // Log verification attempt for debugging
        console.log('Webhook verify request:', { mode, challenge, token });

        // Verify that mode is 'subscribe' and token matches our secret
        if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
            console.log('Webhook verified successfully');
            return challenge; // Return challenge token to complete verification
        }
        console.log('Webhook verification failed'); // Log failure
        return null; // Return null for failed verification
    } catch (error) {
        console.error('Webhook verification error:', error);
        throw error; // Re-throw error for caller to handle
    }
}

/**
 * Handle message status updates from WhatsApp Business API
 * 
 * WhatsApp sends status updates for outgoing messages (sent, delivered, read, failed).
 * This function processes these updates and stores them in the database.
 * 
 * @param {Object} statuses - Status object from WhatsApp webhook
 * @returns {Object|null} Processed status result or null if invalid
 */
const handleMessageStatuses = async (statuses) => {
    try {
        // Validate that required status fields are present
        if (!statuses || !statuses.id || !statuses.status) {
            console.warn('Invalid status data received:', statuses);
            return null; // Return null for invalid data
        }

        // Extract status information from webhook payload
        const {id, status, timestamp, recipient_id} = statuses;
        
        // Create result object with formatted data
        const result = {
            message_id: id, // WhatsApp message ID
            status: status, // Message status (sent, delivered, read, failed)
            recipient_id: recipient_id, // Recipient's WhatsApp ID
            time: timestamp ? formattedDate(timestamp) : 'Unknown' // Formatted timestamp
        }

        try {
            // Update message status in database
            await prisma.message.updateMany({
                where: { messageId: id }, // Find message by WhatsApp message ID
                data: {
                    status: status, // Update with new status
                }
            });
            
        } catch (error) {
            // Log database error but don't fail the whole operation
            console.error('Failed to update message status:', error);
        }

        return result; // Return processed status information
    } catch (error) {
        console.error('Webhook message status error:', error);
        return null; // Return null on error
    }
}

/**
 * Handle incoming messages from WhatsApp users
 * 
 * This function processes different types of incoming messages:
 * - Text messages
 * - Button replies (quick replies)
 * - Interactive list replies
 * - Image messages
 * - Document messages
 * 
 * Each message is logged to the database and processed according to its type.
 * 
 * @param {Object} messages - Message object from WhatsApp webhook
 * @param {string} name - Sender's display name (default: 'Unknown')
 * @returns {Object} Processed message result with success status
 * @throws {Error} If message format is invalid or processing fails
 */
const handleIncomingMessages = async (messages, name = 'Unknown') => {
    // Validate that messages object is properly formatted
    if (!messages || typeof messages !== 'object') {
        throw new Error('Invalid message format'); // Fail for invalid input
    }

    // Extract basic message information
    const { from, id, timestamp, type } = messages;
    
    // Validate that required fields are present
    if (!from || !id || !timestamp) {
        throw new Error('Missing required message fields'); // Fail if essential data missing
    }

    // Initialize variables for message processing
    let messageBody = ''; // Will store the message content
    let extraData = {}; // Will store additional message metadata

    try {
        // Process message based on its type using switch statement
        switch (type) {
            case 'button':
                // Handle quick reply button presses
                messageBody = messages.button?.text || ''; // Extract button text
                extraData = {
                    from: messages.context?.from, // Original message sender
                    context: messages.context?.id, // ID of message being replied to
                }
                // If the button text is "Ready", send a confirmation message
                if (messageBody === "Hazır") {
                    await sendTextMessage(from, "Harika, bir sonraki ders için hazır olun! 😊");
                } else {
                    // Log the button press and handle the reply
                    await logMessageAndContext(id, from, messageBody, type, timestamp, messages.context?.id);
                    await handleQuickReply(from, messageBody, messages.context);
                }
                break;

            case 'text':
                // Handle regular text messages
                messageBody = messages.text?.body || ''; // Extract message text
                // Log the text message
                await logMessageAndContext(id, from, messageBody, type, timestamp);

                try {
                    // Generate AI response using from(number) recent messages with error handling
                    const aiResponse = await generateAIResponse(from);
                    if (aiResponse && aiResponse.trim().length > 0) {
                        // Send AI response and queue message job
                        addJobToQueue(textQueue, "sendText", { phoneNumber: from, message: aiResponse });
                    } else {
                        // If AI response is empty, send a default message
                        addJobToQueue(textQueue, "sendText", { phoneNumber: from, message: "Mesajınız için teşekkürler! En kısa sürede size geri döneceğiz." });
                    }
                } catch (error) {
                    console.error('Failed to generate or send AI response:', error);
                    throw new Error('AI response generation failed', error);
                }
                break;

            case 'image':
                // Handle image messages
                messageBody = '[Image]'; // Placeholder text for images
                extraData = {
                    imageId: messages.image?.id, // WhatsApp image ID
                    mimeType: messages.image?.mime_type, // Image format (jpeg, png, etc.)
                    caption: messages.image?.caption // Optional image caption
                };
                // Log the image message
                await logMessageAndContext(id, from, messageBody, type, timestamp);
                break;

            case 'document':
                // Handle document/file messages
                messageBody = '[Document]'; // Placeholder text for documents
                extraData = {
                    documentId: messages.document?.id, // WhatsApp document ID
                    filename: messages.document?.filename, // Original filename
                    mimeType: messages.document?.mime_type // Document type (pdf, docx, etc.)
                };
                // Log the document message
                await logMessageAndContext(id, from, messageBody, type, timestamp);
                break;

            case 'interactive':
                // Handle interactive message replies (list selections, button clicks)
                messageBody = messages.interactive?.list_reply?.title || messages.interactive?.button_reply?.title;
                extraData = {
                    interactiveType: messages.interactive?.type, // Type of interactive element
                    reply: messages.interactive?.list_reply || messages.interactive?.button_reply // Reply data
                };
                // Log the interactive reply and handle it
                await logMessageAndContext(id, from, messageBody, type, timestamp, messages.context?.id);
                await handleQuickReply(from, messageBody, messages.context);
                break;
            default:
                // Handle unsupported message types
                messageBody = '[Unsupported message type]';
        }

        // Create result object with processed message information
        const result = {
            success: true, // Indicates successful processing
            name: name, // Sender's display name
            number: from, // Sender's WhatsApp number
            message_id: id, // WhatsApp message ID
            type: type, // Message type (text, button, image, etc.)
            message_body: messageBody, // Processed message content
            timestamp: formattedDate(timestamp), // Human-readable timestamp
            ...extraData // Spread any additional message-specific data
        };

        return result; // Return processing result

    } catch (error) {
        // Log detailed error information for debugging
        console.error('Error processing incoming message:', {
            error: error.message,
            messageId: id,
            from: from,
            type: type
        });
        
        // Re-throw error with descriptive message for caller
        throw new Error(`Failed to process message: ${error.message}`);
    }
};



/**
 * Handle quick reply interactions from users
 * 
 * This function processes user responses to course-related messages:
 * - "Start" button replies to activate learner enrollment
 * - "Done" button replies to mark lesson completion
 * - Quiz answer submissions for interactive quizzes
 * 
 * @param {string} from - User's WhatsApp phone number
 * @param {string} messageBody - Content of the reply (button text or quiz answer)
 * @param {Object} context - Context object containing original message ID
 * @returns {void}
 */
const handleQuickReply = async (from, messageBody, context) => {
    // Validate that context contains message ID for reply tracking
    if (!context?.id) {
        console.warn('No context ID provided for quick reply');
        return; // Exit if no context to work with
    }

    try {
        // Import course service functions (dynamic import to avoid circular dependency)
        const { updateCourseProgress } = require('./courseService');
        const repliedToMessageId = context.id; // ID of the original message being replied to
            
        // Find the stored context for the original message
        const messageContext = await prisma.messageContext.findUnique({
            where: { messageId: repliedToMessageId }, // Look up by original message ID
            include: { 
                lesson: true, // Include lesson data if available
            }
        });
        
        // Handle case where no context is found
        if (!messageContext) {
            console.warn(`No message context found for message ID: ${repliedToMessageId}`);
            addJobToQueue(textQueue, "sendText", { phoneNumber: from, message: "⚠️ Üzgünüz, bu mesaj için bağlam bulunamadı. Lütfen tekrar deneyin veya destek ile iletişime geçin." }); //await sendTextMessage(from, "⚠️ Üzgünüz, bu mesaj için bağlam bulunamadı. Lütfen tekrar deneyin veya destek ile iletişime geçin.");
            return; // Exit if context not found
        }
        
        // Extract course and lesson IDs from the stored context
        const { courseId, lessonId } = messageContext;
        
        // Handle "Start" button replies (course enrollment activation)
        if(messageBody === "Başla"){
            try {
                // Activate the learner's account by setting active flag to true
                const setActiveLearner = await prisma.learner.updateMany({
                    where: { number: from }, // Find learner by phone number
                    data: { active: true } // Set active status to true
                });
        
                // Check if any learner records were updated
                if (setActiveLearner.count === 0) {
                    console.warn(`⚠️  No learner found with number: ${from}`);
                    addJobToQueue(textQueue, "sendText", { phoneNumber: from, message: "Üzgünüz, kaydınızı bulamadık. Lütfen destek ile iletişime geçin." });//await sendTextMessage(from, "Üzgünüz, kaydınızı bulamadık. Lütfen destek ile iletişime geçin.");
                    return; // Exit if no learner found
                } else {
                    console.log(`✅ Activated learner with number: ${from} (${setActiveLearner.count} record(s) updated)`);
                }
            } catch (error) {
                // Handle database errors during activation
                console.error('Failed to activate learner:', error);
                addJobToQueue(textQueue, "sendText", { phoneNumber: from, message: "Üzgünüz, hesabınızı etkinleştirirken bir hata oluştu. Lütfen tekrar deneyin.😞" });//await sendTextMessage(from, "Üzgünüz, hesabınızı etkinleştirirken bir hata oluştu. Lütfen tekrar deneyin.😞");
                return; // Exit on error
            }
            // Send confirmation message to user
            addJobToQueue(textQueue, "sendText", { phoneNumber: from, message: "Kursunuza başarıyla kaydoldunuz! 🎉 Başarılar dileriz!" });//await sendTextMessage(from, "Kursumuza kaydolduğunuz için teşekkürler. Kurs başladığında sizi bilgilendireceğiz.🙏");
        }
        // Handle "Done" button replies (lesson completion)
        else if (messageBody === "Tamamdır") {
            // Update progress to mark lesson as completed
            await updateCourseProgress(from, courseId, lessonId);
            // Send congratulatory message
            addJobToQueue(textQueue, "sendText", { phoneNumber: from, message: "Bu dersi tamamladığınız için tebrikler! 🎉" });//await sendTextMessage(from, "Bu dersi tamamladığınız için tebrikler! 🎉");
        }
        // Handle quiz answer submissions (any other reply)
        else {
            // Update progress with quiz answer and get feedback result
            const {correctAnswer, aiQuizContext} = await updateCourseProgress(from, courseId, lessonId, messageBody);

            // Generate AI feedback based on quiz context
            const aiFeedback = await generateAIQuizFeedback(aiQuizContext);

            if (aiFeedback) { 
                // Send AI feedback to user
                addJobToQueue(textQueue, "sendText", { phoneNumber: from, message: aiFeedback });//await sendTextMessage(from, aiFeedback);
            } 
            else {
                // If AI feedback generation is null but correctness info is available, send standard feedback
                if (correctAnswer === null) {
                    // Send positive feedback for correct answer
                    addJobToQueue(textQueue, "sendText", { phoneNumber: from, message: "Doğru! Böyle devam edin! 👏🎉" });//await sendTextMessage(from, "Doğru! Böyle devam edin! 👏🎉");
                } else {
                    // Send feedback with correct answer for wrong answer
                    addJobToQueue(textQueue, "sendText", { phoneNumber: from, message: `Yanlış ❌, doğru cevap: ${correctAnswer}. Bir sonraki sefere daha iyi şanslar!` });//await sendTextMessage(from,`Yanlış ❌, doğru cevap: ${correct}. Bir sonraki sefere daha iyi şanslar!`);
                }
            }
        }
    } catch (error) {
        // Handle any errors that occur during quick reply processing
        console.error('Error in handleQuickReply:', error);
        addJobToQueue(textQueue, "sendText", { phoneNumber: from, message: "Üzgünüz, isteğiniz işlenirken bir hata oluştu. Lütfen tekrar deneyin." });//await sendTextMessage(from, "Üzgünüz, isteğiniz işlenirken bir hata oluştu. Lütfen tekrar deneyin.");
    }
}


/**
 * Log incoming message to database and handle context tracking
 * 
 * This function performs two main tasks:
 * 1. Logs the incoming message to the messages table
 * 2. If the message is a reply, finds and returns the original context
 * 
 * @param {string} id - WhatsApp message ID
 * @param {string} from - Sender's phone number
 * @param {string} messageBody - Message content
 * @param {string} type - Message type (text, button, image, etc.)
 * @param {string} timestamp - Unix timestamp from WhatsApp
 * @param {string|null} contextMessageId - ID of message being replied to (if any)
 * @returns {Object} Context information if reply, or no-context indicator
 */
const logMessageAndContext = async(id, from, messageBody, type, timestamp, contextMessageId) => {
    // Log the incoming message to the database
    try {
        // Use upsert to handle both new messages and webhook retries
        await prisma.message.upsert({
            where: { messageId: id },
            update: {
                // If message already exists (retry), update these fields
                body: messageBody,
                status: "received",
                localtime: new Date(parseInt(timestamp) * 1000 + (3 * 60 * 60 * 1000))
            },
            create: {
                messageId: id, // WhatsApp message ID
                from: from, // Sender's phone number
                to: "zenolearn", // Our system identifier
                body: messageBody, // Message content
                type: type, // Message type for categorization
                direction: "incoming", // Message direction (received by us)
                status: "received", // Message status
                localtime: new Date(parseInt(timestamp) * 1000 + (3 * 60 * 60 * 1000)) // Convert to UTC+3
            }
        });

        // Handle context tracking if this is a reply to another message
        if (contextMessageId) {
            // Find the original message context using the contextMessageId
            const originalMessageContexts = await prisma.messageContext.findMany({
                where: { messageId: contextMessageId, phoneNumber: from }, // Find context for this user and message
                include: {
                    course: true, // Include course details
                    lesson: true, // Include lesson details
                    quiz: true // Include quiz details
                },
                take: 1 // Only get the first match
            });
            
            // Check if we found a matching context
            if (originalMessageContexts && originalMessageContexts.length > 0) {
                const originalContext = originalMessageContexts[0];
                const { courseId, lessonId, quizId, course, lesson, quiz } = originalContext;
                
                // Log detailed context information for debugging
                console.log(`💬 Reply received for:`);
                console.log(`   Course: ${course?.name || 'Unknown'} (ID: ${courseId})`);
                if (lesson) console.log(`   Lesson: ${lesson?.title} (ID: ${lessonId})`);
                if (quiz) console.log(`   Quiz: ${quiz?.question.substring(0, 50)}... (ID: ${quizId})`);
                console.log(`   From: ${from}`);
                console.log(`   Message: ${messageBody}`);
                
                // Return the context information for further processing
                return {
                    hasContext: true, // Indicates context was found
                    courseId, // Course ID for progress tracking
                    lessonId, // Lesson ID for progress tracking
                    quizId, // Quiz ID if applicable
                    course, // Full course object
                    lesson, // Full lesson object
                    quiz // Full quiz object
                };
            } else {
                // Log warning if no context found
                console.warn('⚠️  Original message context not found for:', contextMessageId);
                return { hasContext: false }; // Indicate no context found
            }
        } else {
            // Log that this is not a reply message
            console.log('💬 Message is not a reply to any previous message');
            return { hasContext: false }; // Indicate no context needed
        }
    } catch (error) {
        // Log any errors that occur during message logging
        console.error('Failed to log incoming message:', error);
        return { hasContext: false }; // Return default value on error to prevent crashes
    }
}

/**
 * Delete all messages and their contexts from the database
 * 
 * This function performs a cascading delete of message-related data
 * in the correct order to respect foreign key constraints:
 * 1. Message contexts (references messages)
 * 2. Messages (parent records)
 * 
 * @returns {Object} Result object with count of deleted messages
 * @throws {Error} If deletion fails
 */
const deleteAllMessages = async () => {
    try {
        // Delete MessageContext records first to avoid foreign key constraint violations
        await prisma.messageContext.deleteMany({}); // Delete all message contexts
        
        // Then delete all messages (parent records)
        const result = await prisma.message.deleteMany({}); // Delete all messages
        
        // Log successful deletion
        console.log(`✅ Deleted ${result.count} messages and their contexts`);
        return result; // Return deletion result
    } catch (error) {
        // Log error and re-throw
        console.error('Failed to delete messages:', error);
        throw error; // Re-throw for caller handling
    }
}


/**
 * Store message context for outgoing messages to enable reply tracking
 * 
 * When we send messages to users (lessons, quizzes, etc.), we store context
 * information so we can properly handle their replies. This enables features like:
 * - Tracking which lesson a "Done" reply refers to
 * - Tracking which quiz an answer reply refers to
 * - Associating replies with the correct course
 * 
 * @param {string} phoneNumber - Recipient's WhatsApp phone number
 * @param {string} messageId - WhatsApp message ID of the sent message
 * @param {number} courseId - ID of the related course
 * @param {number|null} lessonId - ID of the related lesson (optional)
 * @param {number|null} quizId - ID of the related quiz (optional)
 * @returns {void}
 */
const storeMessageContext = async (phoneNumber, messageId, courseId, lessonId = null, quizId = null) => {
    try {
        // Create message context record in database
        await prisma.messageContext.create({
            data: {
                messageId: messageId, // WhatsApp message ID for reply tracking
                phoneNumber: phoneNumber, // Recipient's phone number
                courseId: courseId, // Related course ID
                lessonId: lessonId, // Related lesson ID (if applicable)
                quizId: quizId, // Related quiz ID (if applicable)
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Auto-expire after 7 days
            }
        });
        // console.log(`✅ Message context stored for ${messageId}`);
    } catch (error) {
        // Log error but don't throw (context storage is not critical)
        console.error('Failed to store message context:', error);
    }
};

// Export all webhook service functions for use in other modules
module.exports = {
    verifyWebhook, // Function to verify WhatsApp webhook subscription
    handleIncomingMessages, // Function to process incoming messages from users
    handleMessageStatuses, // Function to handle message delivery status updates
    deleteAllMessages, // Function to delete all messages (for testing/cleanup)
    storeMessageContext // Function to store context for outgoing messages
}