const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

router.get('/webhook', webhookController.verifyWebhook);

router.get('/test', (req, res) => res.send('Webhook route works!'));

router.post('/webhook', webhookController.handleWebhook);

router.delete('/all-messages', webhookController.deleteAllMessages);

module.exports = router;