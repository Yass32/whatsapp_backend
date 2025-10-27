const { PrismaClient } = require('@prisma/client');
const { withAccelerate } = require('@prisma/extension-accelerate'); 
const OpenAI = require("openai");


// Initialize Prisma client with Accelerate extension for optimized queries
const prisma = new PrismaClient().$extends(withAccelerate())
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
- Write short, natural, WhatsApp-friendly replies (1–2 sentences).  
- Be helpful, polite, encouraging and supportive, while guiding the learner back to the course context.  
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

const generateAIResponse = async (from) => {
      try {
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
                  take: 6
            })

            console.log("Context messages: ", contextMessages);

            /*

            const aiResponse = await client.chat.completions.create({
                  model: "gpt-5",
                  messages: [
                        { role: "system", content: SYSTEM_PROMPT },
                        { role: "user", content: `Recent conversation messages: ${JSON.stringify(contextMessages, null, 2)}` }
                  ],
                  temperature: 0.7,
                  //max_tokens: 150,
            });

            */

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
                  //"max_tokens": 150,
                  })
            });

            // After parsing:
            const data = await aiResponse.json();  // Parse JSON response
            console.log("AI data response: ", data.choices[0]);

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
      } catch (error) {
        console.error("Error generating AI response:", error);
        return "Mesajınız için teşekkürler! En kısa sürede size geri döneceğiz.";
      }
};


module.exports = {
    generateAIResponse
};