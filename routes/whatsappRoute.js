const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');

router.post('/send-text', whatsappController.sendTextMessage);

router.post('/send-template', whatsappController.sendTemplateMessage);

router.post('/send-image', whatsappController.sendImageMessage); 

router.post('/send-interactive', whatsappController.sendInteractiveMessage); 

module.exports = router;
