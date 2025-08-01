const { format } = require("date-fns");
const { PrismaClient } = require('../generated/prisma');
const { withAccelerate } = require('@prisma/extension-accelerate'); 

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

const handleIncomingMessages = async (messages, name) => {
    const { from, id, timestamp, type } = messages;
    let messageBody = '';
    let extraData = {};

    try {
        // Handle different message types
        switch (type) {
            case 'text':
                messageBody = messages.text?.body || '';
                break;
            case 'image':
                messageBody = '[Image]';
                extraData = {
                    imageId: messages.image?.id,
                    mimeType: messages.image?.mime_type,
                    caption: messages.image?.caption
                };
                break;
            case 'document':
                messageBody = '[Document]';
                extraData = {
                    documentId: messages.document?.id,
                    filename: messages.document?.filename,
                    mimeType: messages.document?.mime_type
                };
                break;
            case 'interactive':
                messageBody = messages.interactive?.button_reply.title;
                extraData = {
                    interactiveType: messages.interactive?.type,
                    buttonReply: messages.interactive?.button_reply,
                    listReply: messages.interactive?.list_reply
                };
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

        // Save to database
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
        } catch (error) {
            throw new Error('Failed to log incoming message');
        }

        return result;
    } catch (error) {
        console.error('Webhook receiving message error:', error);
        throw error;
    }
};

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
            const message = await prisma.message.updateMany({
                where: { messageId: id },
                data: {
                    status: status,
                    //timestamp: timestamp ? new Date(parseInt(timestamp) * 1000) : new Date()
                }
            });
            
        } catch (error) {
            console.error('Failed to update message status:', error);
            // Don't throw error, just log it and return the result
            // This prevents webhook failures from breaking the entire flow
        }

        return result;
    } catch (error) {
        console.error('Webhook message status error:', error);
        // Return null instead of throwing to prevent webhook failures
        return null;
    }
}

const deleteAllMessages = async () => {
    try {
        return prisma.message.deleteMany({});
    } catch (error) {
        throw new Error('Failed to delete messages');
    }
}

module.exports = {
    formattedDate,
    verifyWebhook,
    handleIncomingMessages,
    handleMessageStatuses,
    deleteAllMessages
}