const { lessonQueue, reminderQueue, notificationQueue, textQueue, addJobToQueue } = require('./queueService');
const { PrismaClient } = require('@prisma/client');
const { withAccelerate } = require('@prisma/extension-accelerate'); 


const prisma = new PrismaClient().$extends(withAccelerate());


// Validate required environment variables
if (!process.env.OPENROUTER_API_URL || !process.env.OPENROUTER_API_KEY) {
  console.error('❌ Missing required environment variables: OPENROUTER_API_URL or OPENROUTER_API_KEY');
  console.error('   Please add these to your .env file');
}


// Utility function for API calls with timeout
// Ensures consistent timeout of 60 seconds across all API calls
const callOpenRouterAPI = async (messages, prompt, temperature = 0.7, timeoutMs = 60000) => {
  if (!process.env.OPENROUTER_API_URL || !process.env.OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API credentials not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(process.env.OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "tngtech/deepseek-r1t2-chimera:free",
        messages: [
            { role: "system", content: prompt },
            { role: "user", content: messages }
        ],
        temperature: temperature,
      })
    });

    // Check HTTP response status
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter API error ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();

    // Validate response structure
    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error('Invalid API response: missing choices');
    }

    if (!data.choices[0].message || !data.choices[0].message.content) {
      throw new Error('Invalid API response: missing message content');
    }

    return data.choices[0].message.content;

  } finally {
    clearTimeout(timeout);
  }
};  

// Utility function to clean AI response quotes
const cleanAIResponse = (reply) => {
  if (!reply || typeof reply !== 'string') return '';
  
  let cleaned = reply.trim();
  
  // Remove leading/trailing quotes (single or double)
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
      (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  
  // Remove common markdown formatting
  cleaned = cleaned.replace(/^\*\*(.*?)\*\*$/g, '$1'); // **text** -> text
  cleaned = cleaned.replace(/^\*(.*?)\*$/g, '$1');     // *text* -> text
  
  return cleaned;
};

const generateAIResponse = async (from) => {
      const SYSTEM_PROMPT = `You are Zeno Learn — a friendly and professional microlearning assistant that interacts with learners on WhatsApp.

      🎯 Platform Context:
      Zeno Learn is a WhatsApp-based microlearning platform.  
      Admins create and assign courses consisting of short lessons and quizzes.  
      Learners receive lessons, content, and quizzes directly through WhatsApp, where they can reply using buttons like “Başla”, “Tamamdır”, or type quiz answers.

      🧩 Your Role:
      You act as the WhatsApp chatbot that responds **when learners send unexpected or free-text messages** outside the structured flow.  
      You will:
      - Understand the conversation context using the **last few messages** (both incoming and outgoing).  
      - Reply in the **same language** the learner used most recently.  
      - Write short, natural, WhatsApp-friendly replies (1–3 sentences), send long messages only when its absolutely necessary or when learner asks for explanation.  
      - Be helpful, polite, encouraging and supportive.  
      - Avoid long paragraphs, markdown, or technical talk. 
      - If learner asks for help, reply with a helpful message. 
      - If learner asks when the next lesson will be sent, reply with a message that the next lesson will be sent soon, followed by an encouraging message. 
      - If the learner seems off-topic, respond kindly and bring the focus back to learning.
      - You are not responsible for sending lessons, only to assist in questions

      🧭 Context Input:
      You will be given the last few WhatsApp messages (3–5) in JSON-like format, each containing:
      - **body**: the text of the message  
      - **direction**: “incoming” (from learner) or “outgoing” (from system/admin)  
      - **localtime**: timestamp of when it was sent or received
      - **type**: “text”, “image”, “video”, “whatsapp_template”, etc.  

      Use these to understand the flow of the conversation.

      💬 Output Instructions:
      - Produce only the **final message** that the chatbot should send back to the learner.
      - The tone should match the learner’s language and formality.
      - Keep it human, empathetic, and clear.

      🧠 Example Behaviors:
      - If learner says “Merhaba”, reply: “Merhaba! 😊”
      - If learner says “I’m stuck”, reply: “No problem! Can you tell me which part is confusing?”
      - If learner says “Ne zaman yeni ders gelecek?”, reply: “Yeni dersler yakında gönderilecek! Hazır olduğunuzda ‘Başla’ yazabilirsiniz. 📚”
      - If learner goes off-topic (“How old are you?”), reply: “Ben Zeno Learn asistanıyım! 😊 Derslerinizle ilgili sorulara yardımcı olabilirim.”

      🎓 Your personality:
      You are warm, professional, and focused on learning.  
      Your main goal is to keep learners engaged and supported while keeping the conversation short and meaningful.
      `

      try {
            // Fetch the last 8 messages from conversation history (both incoming and outgoing)
            // This provides AI with context to understand the learner's needs and previous interactions
            const contextMessages = await prisma.message.findMany({
                  where: {
                        OR: [
                        { from: from },
                        { to: from }
                        ]
                  },
                  select: {
                        direction: true,
                        body: true,
                        localtime: true,
                        type: true
                  },
                  orderBy: {
                        createdAt: "desc"
                  },
                  take: 8
            })

            // Format conversation history as JSON string for AI context
            // The AI system prompt will use this to understand the conversation flow
            const messages = `Recent conversation messages: ${JSON.stringify(contextMessages, null, 2)}`

            // Call OpenRouter API with temperature 0.7 for balanced creativity and accuracy
            // Timeout: 60 seconds to match webhook timeout constraints
            const reply = await callOpenRouterAPI(messages, SYSTEM_PROMPT, 0.7, 60000)

            // Clean and return the AI response (remove quotes, markdown formatting)
            return cleanAIResponse(reply);

            /*
            const aiResponse = await fetch(process.env.OPENROUTER_API_URL, {
                  method: "POST",
                  headers: {
                  "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                  "Content-Type": "application/json"
                  },
                  body: JSON.stringify({
                  "model": "tngtech/deepseek-r1t2-chimera:free",
                  "messages": [
                        { role: "system", content: SYSTEM_PROMPT },
                        { role: "user", content: `Recent conversation messages: ${JSON.stringify(contextMessages, null, 2)}` }
                  ],
                  "temperature": 0.7,
                  })
            });

            // After parsing:
            const data = await aiResponse.json();  // Parse JSON response
            console.log("AI data response: ", data.choices[0].message);

            if (!data.choices || !data.choices[0]) {
                  throw new Error('Invalid AI response structure');
            }

            // Clean the AI response to remove extra quotes
            let reply = data.choices[0].message.content.trim();
            if ((reply.startsWith('"') && reply.endsWith('"')) || 
                (reply.startsWith("'") && reply.endsWith("'"))) {
                reply = reply.slice(1, -1).trim();
            }

            return reply;
            */
      } catch (error) {
        console.error("Error generating AI response:", error);
        return null;
      }
};


/**
 * AI Quiz Feedback Generator
 * 
 * Generates feedback for a learner's quiz answer:
 * - If correct → congratulate + explain why
 * - If wrong → explain mistake + give correct answer + encourage
 * - Respond in learner's language
 * - Keep messages short, WhatsApp-friendly
 */

const generateAIQuizFeedback = async (aiQuizContext) => {

  const SYSTEM_PROMPT = `
You are Zeno Learn, an AI tutor on WhatsApp.
Your job is to give quiz feedback based on the learner's answer.

===== PLATFORM CONTEXT =====
Zeno Learn is a microlearning system where learners receive lessons and quizzes by WhatsApp.
You must reply like a friendly WhatsApp assistant.

===== YOUR TASK =====
Using the quiz context and learner's answer:
- If the learner is correct:
  * Praise them warmly
  * Explain briefly why it is correct
  * Encourage them to continue
- If the learner is wrong:
  * Explain briefly why their answer is incorrect
  * Provide the correct answer clearly
  * Encourage them kindly

===== LANGUAGE RULE =====
Always reply in the SAME LANGUAGE the learner used in their answer.

===== STYLE RULES =====
- 1–4 short WhatsApp-friendly sentences.
- Be warm, supportive, and clear.
- You are the Zeno Learn assistant.
`;

  try {

      //
      const messages = `${aiQuizContext} \n Determine if the learner is correct. Then generate the appropriate feedback.`

      // Call OpenRouter API with await and consistent timeout
      const reply = await callOpenRouterAPI(messages, SYSTEM_PROMPT, 0.4)

      // Clean and return the AI response
      return cleanAIResponse(reply);

      /*
      const aiResponse = await fetch(process.env.OPENROUTER_API_URL, {
            method: "POST",
            headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json"
            },
            body: JSON.stringify({
            model: "tngtech/deepseek-r1t2-chimera:free",
            messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `${aiQuizContext} \n Determine if the learner is correct. Then generate the appropriate feedback.`}
            ],
            temperature: 0.5,
            })
      });

      const data = await aiResponse.json();
      console.log("AI quiz feedback:", data.choices?.[0]?.message);

      if (!data.choices || !data.choices[0]) {
            throw new Error("Invalid AI response format");
      }

      let reply = data.choices[0].message.content.trim();

      // Remove extraneous quote wrapping
      if (
            (reply.startsWith('"') && reply.endsWith('"')) ||
            (reply.startsWith("'") && reply.endsWith("'"))
      ) {
            reply = reply.slice(1, -1).trim();
      }

      return reply;
      */

  } catch (error) {
    console.error("Error generating quiz feedback:", error);
    return null;
  }
};



module.exports = {
    generateAIResponse,
    generateAIQuizFeedback
};