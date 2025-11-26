/**
 * WhatsApp Service Module
 * 
 * This module handles all WhatsApp Business API interactions including:
 * - Sending text messages
 * - Sending template messages with quick replies
 * - Sending image messages
 * - Sending interactive button and list messages
 * - Logging all messages to database
 * 
 * @author Your Name
 * @version 1.0.0
 */

// Import required dependencies
const axios = require('axios'); // HTTP client for API requests
const { PrismaClient } = require('@prisma/client'); // Database ORM client
const { withAccelerate } = require('@prisma/extension-accelerate'); // Prisma performance extension

// Initialize Prisma client with acceleration for better performance
const prisma = new PrismaClient().$extends(withAccelerate())

// Extract WhatsApp API credentials from environment variables
const {WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_API_URL} = process.env;

// Construct the base URL for WhatsApp API messages endpoint
const baseUrl = `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

// Define standard headers for all WhatsApp API requests
const headers =  {
      'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`, // Bearer token for authentication
      'Content-Type': 'application/json' // Specify JSON content type
};
  
/**
 * Send a simple text message via WhatsApp Business API
 * 
 * @param {string} to - Recipient's WhatsApp number (with country code)
 * @param {string} message - Text message content to send
 * @returns {Object} Database record of the sent message
 * @throws {Error} If message sending or logging fails
 */
const sendTextMessage = async (to, message) => {
      try {
            // Construct the message payload according to WhatsApp API format
            const payload = {
              messaging_product: 'whatsapp', // Specify WhatsApp as the messaging product
              to: to, // Recipient phone number
              type: 'text', // Message type identifier
              text: { body: message} // Message content wrapped in text object
            };

            // Send POST request to WhatsApp API with message payload
            const response = await axios.post(baseUrl, payload, {
              headers: headers
            });

            // Log the sent message to database for tracking and analytics
            try {
              const messageLog = await prisma.message.create({
                data: {
                  messageId: response.data.messages[0].id, // WhatsApp message ID from response
                  from: "zenolearn", // Sender identifier (our system)
                  to: response.data.contacts[0].wa_id, // Recipient WhatsApp ID from response
                  body: message, // Message content
                  type: "text", // Message type for database categorization
                  direction: "outgoing", // Message direction (sent by us)
                  localtime: new Date(new Date().getTime() + (3 * 60 * 60 * 1000)) // Convert to UTC+3 timezone
                }
              })
              return messageLog; // Return database record for confirmation

            } catch (error) {
              console.error(error) // Log database error
              throw new Error('Failed to log text message'); // Throw user-friendly error
            }
            
      } catch (error) {
          // Log detailed error information for debugging
          console.error('Error sending message:', error.response?.data || error.message);
          throw error; // Re-throw error for caller to handle
      }
}

/**
 * Send a template message with dynamic parameters and optional quick reply button
 * 
 * Template messages are pre-approved message formats that can include:
 * - Dynamic header text (max 60 characters per parameter, truncated if exceeded)
 * - Dynamic body text (max 1024 characters per parameter, truncated if exceeded)
 * - Quick reply buttons
 * 
 * @param {string} to - Recipient's WhatsApp number
 * @param {string} templateName - Name of the approved template
 * @param {string} languageCode - Language code (e.g., 'en', 'ar')
 * @param {Object} parameters - Object containing header and body parameter arrays
 * @param {string|Array} quickReply - Quick reply button text or array of buttons
 * @returns {Object} Database record of the sent template message
 * @throws {Error} If template sending or logging fails
 */
const sendTemplateMessage = async (to, templateName, languageCode, parameters, quickReply) => {
  // Safely extract header and body parameters with default empty arrays
  const { header = [], body = [] } = parameters || {};
  
  try {
    // Initialize components array to build template structure
    const components = [];
    
    // Add header component if header parameters are provided
    if (header.length > 0) {
      components.push({
        type: 'header', // Component type for template header
        parameters: header.map(param => ({ // Map each header parameter
          type: 'text', // Parameter type (text, image, etc.)
          // WhatsApp template header limit: 60 characters per parameter
          // Truncate to 58 chars and append '..' to indicate truncation
          text: param.length > 60? param.substring(0, 58) + '..' : param
        }))
      });
    }
    
    // Add body component if body parameters are provided
    if (body.length > 0) {
      components.push({
        type: 'body', // Component type for template body
        parameters: body.map(param => ({ // Map each body parameter
          type: 'text', // Parameter type
          // WhatsApp template body limit: 1024 characters per parameter
          // Truncate to 1022 chars and append '..' to indicate truncation
          text: param.length > 1024? param.substring(0, 1022) + '..' : param
        }))
      });
    }

    // Add quick reply buttons if provided and not empty
    if (quickReply) {
      const buttons = Array.isArray(quickReply) ? quickReply : [quickReply];
      
      components.push({
        type: 'button',
        sub_type: 'quick_reply',
        index: '0',
        parameters: buttons.map((button, index) => ({
          type: 'payload',
          payload: JSON.stringify({
            button_reply: {
              id: `${templateName.toLowerCase()}_${index}`,
              title: button
            }
          })
        }))
      });
    }

    // Construct the complete template message payload
    const payload = {
      messaging_product: 'whatsapp', // Specify WhatsApp as messaging product
      to: to, // Recipient phone number
      type: 'template', // Message type for templates
      template: {
        name: templateName, // Name of the pre-approved template
        language: {
          code: languageCode ? languageCode : 'en' // Language code with English fallback
        },
        components: components // Array of template components (header, body, buttons)
      }
    };
    
    // Optional: Log payload for debugging (commented out for production)
    //console.log('Template payload:', JSON.stringify(payload, null, 2));

    // Validate that required template information is present
    if (!payload.template || !payload.template.name) {
      throw new Error('Template name is required'); // Fail fast if template name missing
    }

    // Send the template message via WhatsApp API
    const response = await axios.post(baseUrl, payload, {
      headers: headers
    });
    
    // Log the sent template message to database
    try {
      const message = await prisma.message.create({
        data: {
          messageId: response.data.messages[0].id, // WhatsApp message ID
          from: "zenolearn", // Sender identifier
          to: response.data.contacts[0].wa_id, // Recipient WhatsApp ID
          body: parameters.header? (parameters.header.join(' ') + ' ' + parameters.body.join(' ')).trim() : parameters.body.join(' '), // Store template message as message body
          type: "template", // Message type for database categorization
          direction: "outgoing", // Message direction
          localtime: new Date(new Date().getTime() + (3 * 60 * 60 * 1000)) // UTC+3 timezone
        }
      })
      return message; // Return database record
    } catch (error) {
      throw new Error('Failed to log template message'); // Database logging error
    }

  } catch (error) {
    // Log detailed error for debugging
    console.error('Error sending template message:', error.response?.data || error.message);
    throw error; // Re-throw for caller handling
  }
}


/**
 * Send an image message with optional caption via WhatsApp Business API
 * 
 * @param {string} to - Recipient's WhatsApp number
 * @param {string} imageUrl - URL of the image to send (must be publicly accessible)
 * @param {string} caption - Optional caption text for the image
 * @returns {Object} Database record of the sent image message
 * @throws {Error} If image sending or logging fails
 */
const sendImageMessage = async(to, imageUrl, caption) => {
    try {
      // Construct image message payload
      const payload = {
        messaging_product: 'whatsapp', // Specify WhatsApp as messaging product
        to: to, // Recipient phone number
        type: 'image', // Message type for images
        image: {
          link: imageUrl, // Public URL of the image
          caption: caption? caption : null // Optional caption text
        }
      };

      // Send image message via WhatsApp API
      const response = await axios.post(baseUrl, payload, {
        headers: headers
      });

      // Log the sent image message to database
      try {
        const message = await prisma.message.create({
          data: {
            messageId: response.data.messages[0].id, // WhatsApp message ID
            from: "zenolearn", // Sender identifier
            to: response.data.contacts[0].wa_id, // Recipient WhatsApp ID
            body: imageUrl, // Store image URL as message body
            type: "image", // Message type for database categorization
            direction: "outgoing", // Message direction
            localtime: new Date(new Date().getTime() + (3 * 60 * 60 * 1000)) // UTC+3 timezone
          }
        })
        return message; // Return database record
      } catch (error) {
        throw new Error('Failed to log image message'); // Database logging error
      }
    } catch (error) {
      // Log detailed error for debugging
      console.error('Error sending image message:', error.response?.data || error.message);
      throw error; // Re-throw for caller handling
    }
}

/**
 * Send interactive button message for quiz questions
 * 
 * Creates a message with up to 3 clickable buttons for quiz options.
 * WhatsApp limits interactive buttons to maximum 3 options and 20 characters per button title (truncated if exceeded).
 * 
 * @param {string} to - Recipient's WhatsApp number
 * @param {string} quizQuestion - The quiz question text
 * @param {Array} options - Array of answer options (max 3 will be used)
 * @returns {Object} Database record of the sent interactive message
 * @throws {Error} If message sending or logging fails
 */
const sendInteractiveMessage = async (to, quizQuestion, options) => {
  try {
    // Construct interactive button message payload
    const payload = {
      messaging_product: 'whatsapp', // Specify WhatsApp as messaging product
      to: to, // Recipient phone number
      type: 'interactive', // Message type for interactive messages
      interactive: {
        type: 'button', // Interactive type for button messages
        header: {
          type:"text", // Header type
          text: "Quiz" // Static header text
        },
        body: {
          text: quizQuestion // Main question text in body
        },
        footer: {
          text: "Pick the correct option to answer the question" // Instruction text
        },
        action: {
          // Create buttons from options array (max 3 buttons allowed by WhatsApp)
          buttons: options.slice(0, 3).map((option, index) => {
            // WhatsApp button title limit: 20 characters per button
            // Truncate to 17 chars + '..' (3 chars) = 20 characters total
            // This ensures the button text fits within WhatsApp's character limit
            const truncatedTitle = option.length > 20 ? option.substring(0, 17) + '...' : option;
            return {
              type: 'reply', // Button type for reply buttons
              reply: {
                id: `option_${index}`, // Unique identifier for this option
                title: truncatedTitle // Button text (truncated if needed)
              }
            };
          })
        }
      }
    };

    // Send interactive message via WhatsApp API
    const response = await axios.post(baseUrl, payload, {
      headers: headers
    });    
    
    // Log the sent interactive message to database
    try {
      const quiz = await prisma.message.create({
        data: {
          messageId: response.data.messages[0].id, // WhatsApp message ID
          from: "zenolearn", // Sender identifier
          to: response.data.contacts[0].wa_id, // Recipient WhatsApp ID
          body: quizQuestion, // Store question as message body
          type: "quiz", // Message type for database categorization
          direction: "outgoing", // Message direction
          localtime: new Date(new Date().getTime() + (3 * 60 * 60 * 1000)) // UTC+3 timezone
        }
      })
      return quiz; // Return database record
    } catch (error) {
      throw new Error('Failed to log interactive message'); // Database logging error
    }

  } catch (error) {
    // Log detailed error for debugging
    console.error('Error sending button message:', error.response?.data || error.message);
    throw error; // Re-throw for caller handling
  }
}

/**
 * Send interactive list message for quiz questions with multiple options
 * 
 * Creates a dropdown list message that can handle more than 3 options.
 * Users tap a button to open the list and select their answer.
 * WhatsApp limits list row titles to 24 characters (truncated if exceeded).
 * 
 * @param {string} to - Recipient's WhatsApp number
 * @param {string} quizQuestion - The quiz question text
 * @param {Array} options - Array of answer options (can be more than 3)
 * @returns {Object} Database record of the sent interactive list message
 * @throws {Error} If message sending or logging fails
 */
const sendInteractiveListMessage = async (to, quizQuestion, options) => {
  try {
    // Construct interactive list message payload
    const payload = {
      messaging_product: 'whatsapp', // Specify WhatsApp as messaging product
      to: to, // Recipient phone number
      type: 'interactive', // Message type for interactive messages
      interactive: {
        type: 'list', // Interactive type for list messages
        header: {
          type: 'text', // Header type
          text: "Quiz" // Static header text
        },
        body: {
          text: quizQuestion // Main question text in body
        },
        footer: {
          text: "Zenolearn" // Footer branding text
        },
        action: {
          button: "Bir seçenek seçin", // Text shown on the list button
          sections: [
            { 
              title: "Choose one", // Section title within the list
              // Map all options to list rows (no limit like buttons)
              rows: options.map((option, index) => {
                // WhatsApp list row title limit: 24 characters
                // Truncate to 22 chars + '..' (2 chars) = 24 characters total
                // This ensures each row title fits within WhatsApp's display limit
                const truncatedOption = option.length > 24 ? option.substring(0, 22) + '..' : option;
                return {
                  id: `option_${index}`, // Unique identifier for this option
                  title: truncatedOption // Option text (truncated if needed)
                };
              })
            }
          ]
        }
      }
    };

    // Send interactive list message via WhatsApp API
    const response = await axios.post(baseUrl, payload, {
      headers: headers
    });

    // Log the sent interactive list message to database
    try {
      const listMessage = await prisma.message.create({
        data: {
          messageId: response.data.messages[0].id, // WhatsApp message ID
          from: "zenolearn", // Sender identifier
          to: response.data.contacts[0].wa_id, // Recipient WhatsApp ID
          body: quizQuestion, // Store question as message body
          type: "interactive_list", // Message type for database categorization
          direction: "outgoing", // Message direction
          localtime: new Date(new Date().getTime() + (3 * 60 * 60 * 1000)) // UTC+3 timezone
        }
      });
      return listMessage; // Return database record
    } catch (error) {
      console.error('Error logging list message:', error); // Log database error
      throw new Error('Failed to log interactive list message'); // Database logging error
    }

  } catch (error) {
    // Log detailed error for debugging
    console.error('Error sending list message:', error.response?.data || error.message);
    throw error; // Re-throw for caller handling
  }
};

/**
 * Send a document message via WhatsApp Business API
 * 
 * @param {string} to - Recipient's WhatsApp number (with country code)
 * @param {string} documentUrl - Publicly accessible URL of the document
 * @param {string} [filename] - Optional custom filename for the document
 * @param {string} [caption] - Optional caption for the document
 * @returns {Object} Database record of the sent document message
 * @throws {Error} If document sending or logging fails
 */
const sendDocument = async (to, documentUrl, filename, caption) => {
  try {
    // Construct the document payload according to WhatsApp API format
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'document',
      document: {
        link: documentUrl,
        caption: caption || '',
        filename: filename || 'document.pdf' // Default filename if not provided
      }
    };

    // Send POST request to WhatsApp API with document payload
    const response = await axios.post(baseUrl, payload, { headers });

    // Log the sent document message to database
    try {
      const messageLog = await prisma.message.create({
        data: {
          messageId: response.data.messages[0].id,
          from: "zenolearn",
          to: response.data.contacts[0].wa_id,
          body: filename || 'Document',
          type: "document",
          direction: "outgoing",
          localtime: new Date(new Date().getTime() + (3 * 60 * 60 * 1000)),
        }
      });
      return messageLog;
    } catch (error) {
      console.error('Database logging error:', error);
      throw new Error('Failed to log document message');
    }
  } catch (error) {
    console.error('Error sending document:', error.response?.data || error.message);
    throw new Error('Failed to send document message');
  }
};

/**
 * Send a video message via WhatsApp Business API
 * 
 * @param {string} to - Recipient's WhatsApp number (with country code)
 * @param {string} videoUrl - Publicly accessible URL of the video
 * @param {string} [caption] - Optional caption for the video
 * @returns {Object} Database record of the sent video message
 * @throws {Error} If video sending or logging fails
 */
const sendVideo = async (to, videoUrl, caption) => {
  try {
    // Construct the video payload according to WhatsApp API format
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'video',
      video: {
        link: videoUrl,
        caption: caption || ''
      }
    };

    // Send POST request to WhatsApp API with video payload
    const response = await axios.post(baseUrl, payload, { headers });

    // Log the sent video message to database
    try {
      const messageLog = await prisma.message.create({
        data: {
          messageId: response.data.messages[0].id,
          from: "zenolearn",
          to: response.data.contacts[0].wa_id,
          body: 'Video message',
          type: "video",
          direction: "outgoing",
          localtime: new Date(new Date().getTime() + (3 * 60 * 60 * 1000)),
        }
      });
      return messageLog;
    } catch (error) {
      console.error('Database logging error:', error);
      throw new Error('Failed to log video message');
    }
  } catch (error) {
    console.error('Error sending video:', error.response?.data || error.message);
    throw new Error('Failed to send video message');
  }
};

// Export all WhatsApp service functions for use in other modules
module.exports = {
  sendTextMessage, // Function to send simple text messages
  sendTemplateMessage, // Function to send template messages with parameters
  sendImageMessage, // Function to send image messages with optional captions
  sendInteractiveMessage, // Function to send interactive button messages (max 3 options)
  sendInteractiveListMessage, // Function to send interactive list messages (unlimited options)
  sendDocument, // Function to send document messages
  sendVideo // Function to send video messages
}