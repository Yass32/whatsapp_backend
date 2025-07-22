const { format } = require("date-fns");

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
    const {from, id, timestamp, text, type} = messages;
    try {
        const result = {
            name: name,
            number: from,
            message_id: id,
            message_body: text.body,
            type: type,
            timestamp: formattedDate(timestamp)
        }
        return result;
    } catch (error) {
        console.error('Webhook recieving message error:', error);
        throw error; // throw instead of return
    }
}

const handleMessageStatuses = async (statuses) => {
    const {id, status, timestamp, recipient_id} = statuses;
    try {
        console.log(`Message Status Update:
            message_id: ${id},
            status: ${status},
            recipient_id: ${recipient_id},
            time: ${formattedDate(timestamp)}
            `);
        const result = {
            message_id: id,
            status: status,
            recipient_id: recipient_id,
            time: formattedDate(timestamp)
        }
        return result;
    } catch (error) {
        console.error('Webhook message status error:', error);
        throw error; // throw instead of return
    }
}

module.exports = {
    verifyWebhook,
    handleIncomingMessages,
    handleMessageStatuses
}