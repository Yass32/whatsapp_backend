const axios = require('axios');
const { PrismaClient } = require('../generated/prisma');
const { withAccelerate } = require('@prisma/extension-accelerate'); 

const prisma = new PrismaClient().$extends(withAccelerate())

const {WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_API_URL} = process.env;

const baseUrl = `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

// Get headers for API requests
const headers =  {
      'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
};
  
// Send a simple text message
const sendTextMessage = async (to, message) => {
      try {
            const payload = {
              messaging_product: 'whatsapp',
              to: to,
              type: 'text',
              text: { body: message}
            };

            const response = await axios.post(baseUrl, payload, {
              headers: headers
            });

            const result = {
              recipient_id: response.data.contacts[0].wa_id,
              message_id: response.data.messages[0].id,
              message: message
            };

            try {
              const message = await prisma.message.create({
                data: {
                  messageId: response.data.messages[0].id,
                  to: response.data.contacts[0].wa_id,
                  body: message,
                  type: "Text",
                  direction: "outgoing",
                }
              })
              console.log("Messages table updated successfully", message) ;
            } catch (error) {
              throw new Error('Failed to log text message');
            }

            return result;
      } catch (error) {
            console.error('Error sending message:', error.response?.data || error.message);
            throw error;
      }
}

// Send a template message
const sendTemplateMessage = async (to, templateName, languageCode, parameters = []) => {
      try {
        const payload = {
          messaging_product: 'whatsapp',
          to: to,
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: languageCode? languageCode : 'en'
            },
            components: parameters.length > 0 ? [{
              type: 'body',
              parameters: parameters.map(param => ({
                type: 'text',
                text: param
              }))
            }] : []
          }
        };
  
        const response = await axios.post(baseUrl, payload, {
          headers: headers
        });
  
        const result = {
          recipient_id: response.data.contacts[0].wa_id,
          message_id: response.data.messages[0].id,
          message: templateName,
        };
        
        try {
          const message = await prisma.message.create({
            data: {
              messageId: response.data.messages[0].id,
              to: response.data.contacts[0].wa_id,
              body: templateName,
              type: "Template",
              direction: "outgoing"
            }
          })
          console.log("Messages table updated successfully", message) ;
        } catch (error) {
          throw new Error('Failed to log template message ');
        }
        return result;
      } catch (error) {
        console.error('Error sending template message:', error.response?.data || error.message);
        throw error;
      }
}

module.exports = {
  sendTextMessage,
  sendTemplateMessage
}