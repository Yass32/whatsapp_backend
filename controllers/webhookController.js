const webhookService = require('../services/webhookService');
const verifyWebhook = async (request, response) => {
    try {
        const res = await webhookService.verifyWebhook(request);
        if (res) {
            response.status(200).send(res);
        } else {
            response.sendStatus(403);
        }
    } catch (error) {
        response.status(500).json({ error: error.message });
    }
}

const handleWebhook = async (request, response) => {
    try {
        const {entry} = request.body;

        if(!entry || entry.length === 0) {
            return response.status(400).send('Invalid Request');
        }

        const changes = entry[0].changes;

        if(!changes || changes.length === 0) {
            return response.status(400).send('Invalid Request');
        }

        const statuses = changes[0].value.statuses ? changes[0].value.statuses[0] : null;
        if (statuses) { 
            const result = await webhookService.handleMessageStatuses(statuses);
            return response.status(200).json({
                success: true,
                message: 'Template message sent successfully',
                data: result
            });
        };

        const messages = changes[0].value.messages ? changes[0].value.messages[0] : null;
        if (messages) { 
            const result = await webhookService.handleIncomingMessages(messages, changes[0].value.contacts[0].profile.name);
            return response.status(200).json({
                success: true,
                message: 'Template message sent successfully',
                data: result
            });
        };
      } catch (error) {
        console.error('Webhook handling error:', error);
        response.status(500).json({ error: error.message });
    }

}

module.exports = {
    verifyWebhook,
    handleWebhook
}