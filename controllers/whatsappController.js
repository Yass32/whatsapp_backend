const whatsappService = require('../services/whatsappService');

const sendTextMessage = async (request, response) => {
    const { to, message } = request.body;
    try {
      // Validation
      if (!to || !message) {
        return response.status(400).json({
          error: 'Bad Request',
          message: 'Both "to" and "message" fields are required'
        });
      }

      const result = await whatsappService.sendTextMessage(to, message);
      response.status(200).json({
        success: true,
        message: 'Text message sent successfully',
        data: result
      });
    } catch (error) {
      response.status(500).json({ error: error.message });
    }
}

const sendTemplateMessage = async (request, response) => {
    try {
        const { to, templateName, languageCode, parameters } = request.body;
        
        // Validation
        if (!to || !templateName) {
          return response.status(400).json({
            error: 'Bad Request',
            message: 'Both "to" and "templateName" fields are required'
          });
        }
        // Send template message
        const result = await whatsappService.sendTemplateMessage(to, templateName, languageCode, parameters);
        
        // Use the same structure as sendTextMessage
        response.status(200).json({
            success: true,
            message: 'Template message sent successfully',
            data: result
        });
    } catch (error) {
      console.error('Error in sendTemplateMessage:', error.message);
      response.status(500).json({error: 'Internal Server Error', message: error.message});
    }
};

const sendImageMessage = async (request, response) => {
  const { to, imageUrl, caption } = request.body;
  try {
    // Validation
    if (!to || !imageUrl) {
      return response.status(400).json({
        error: 'Bad Request',
        message: 'Both "to" and "imageUrl" fields are required'
      });
    }

    const result = await whatsappService.sendImageMessage(to, imageUrl, caption);
    response.status(200).json({
      success: true,
      message: 'Image message sent successfully',
      data: result
    });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
}

const sendInteractiveMessage = async (request, response) => {
  const { to, quizQuestion, options } = request.body;
  try {
    // Validation
    if (!to || !quizQuestion) {
      return response.status(400).json({
        error: 'Bad Request',
        message: 'Both "to" and "quizQuestion" fields are required'
      });
    }

    const result = await whatsappService.sendInteractiveMessage(to, quizQuestion, options);
    response.status(200).json({
      success: true,
      message: 'Interactive message sent successfully',
      data: result
    });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
}



module.exports = {
  sendTextMessage,
  sendTemplateMessage,
  sendImageMessage,
  sendInteractiveMessage
}