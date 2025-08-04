const axios = require('axios');
const { format } = require("date-fns");
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


            try {
              const messageLog = await prisma.message.create({
                data: {
                  messageId: response.data.messages[0].id,
                  from: "zenolearn",
                  to: response.data.contacts[0].wa_id,
                  body: message,
                  type: "text",
                  direction: "outgoing",
                  localtime: new Date(new Date().getTime() + (3 * 60 * 60 * 1000))//UTC +3
                }
              })
              return messageLog;

            } catch (error) {
              console.error(error)
              throw new Error('Failed to log text message');
            }
            
      } catch (error) {
          console.error('Error sending message:', error.response?.data || error.message);
          throw error;
      }
}

// Send a template message
const sendTemplateMessage = async (to, templateName, languageCode, parameters) => {
  const { header = [], body = [] } = parameters;
  
  try {
    // Build components array properly
    const components = [];
    
    // Add header component if header parameters exist
    if (header.length > 0) {
      components.push({
        type: 'header',
        parameters: header.map(param => ({
          type: 'text',
          text: param
        }))
      });
    }
    
    // Add body component if body parameters exist
    if (body.length > 0) {
      components.push({
        type: 'body',
        parameters: body.map(param => ({
          type: 'text',
          text: param
        }))
      });
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode ? languageCode : 'en'
        },
        components: components
      }
    };
    
    console.log('Template payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post(baseUrl, payload, {
      headers: headers
    });
    
    try {
      const message = await prisma.message.create({
        data: {
          messageId: response.data.messages[0].id,
          from: "zenolearn",
          to: response.data.contacts[0].wa_id,
          body: templateName,
          type: "template",
          direction: "outgoing",
          localtime: new Date(new Date().getTime() + (3 * 60 * 60 * 1000))//UTC +3
        }
      })
      return message;
    } catch (error) {
      throw new Error('Failed to log template message');
    }

  } catch (error) {
    console.error('Error sending template message:', error.response?.data || error.message);
    throw error;
  }
}


  // Send an image message
  const sendImageMessage = async(to, imageUrl, caption) => {
    try {
      const payload = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'image',
        image: {
          link: imageUrl,
          caption: caption? caption : null
        }
      };

      const response = await axios.post(baseUrl, payload, {
        headers: headers
      });

      try {
        const message = await prisma.message.create({
          data: {
            messageId: response.data.messages[0].id,
            from: "zenolearn",
            to: response.data.contacts[0].wa_id,
            body: imageUrl,
            type: "image",
            direction: "outgoing",
            localtime: new Date(new Date().getTime() + (3 * 60 * 60 * 1000))//UTC +3
          }
        })
        return message;
      } catch (error) {
        throw new Error('Failed to log image message');
      }
    } catch (error) {
      console.error('Error sending image message:', error.response?.data || error.message);
      throw error;
    }
}

// Send interactive button message
const sendInteractiveMessage = async (to, bodyTitle, bodyText, quizQuestion, options) => {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'button',
        header: {
          type:"text",
          text: bodyTitle
        },
        body: {
          text: bodyText
        },
        footer: {
          text: quizQuestion? quizQuestion : null
        },
        action: {
          buttons: options.length === 0 ? [{
            type: 'reply',
            reply: {
              id: 'done',
              title: 'Done'
            }
          }] : options.slice(0, 3).map((option, index) => {
            // Truncate option text to max 20 characters for WhatsApp button title
            const truncatedTitle = option.length > 20 ? option.substring(0, 17) + '...' : option;
            return {
              type: 'reply',
              reply: {
                id: `option_${index}`,
                title: truncatedTitle
              }
            };
          })
        }
      }
    };

    const response = await axios.post(baseUrl, payload, {
      headers: headers
    });    
    
    try {
      const quiz = await prisma.message.create({
        data: {
          messageId: response.data.messages[0].id,
          from: "zenolearn",
          to: response.data.contacts[0].wa_id,
          body: quizQuestion? quizQuestion : `No quiz for lesson: ${bodyTitle}`,
          type: "lesson & question",
          direction: "outgoing",
          localtime: new Date(new Date().getTime() + (3 * 60 * 60 * 1000))//UTC +3
        }
      })
      return quiz;
    } catch (error) {
      throw new Error('Failed to log interactive message');
    }


  } catch (error) {
    console.error('Error sending button message:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  sendTextMessage,
  sendTemplateMessage,
  sendImageMessage,
  sendInteractiveMessage
}