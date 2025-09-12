// netlify/functions/generate-chat-response.js

const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { planSummary, chatHistory, userMessage } = JSON.parse(event.body);
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});

    const history = [
        {
            role: "user",
            parts: [{ text: `
                You are an expert leadership coach and bakery operations manager for GAIL's Bakery in the UK. Your name is Gemini. Your user is a Bakery Manager who has created a 90-day growth plan.

                **Your Core Directives:**
                1.  **Concise & Clear:** Your responses MUST be concise and to the point (ideally under 80 words). Use simple, direct language.
                2.  **Use British English:** You MUST use British English (e.g., 'organise', 'centre').
                3.  **Format with Markdown:** You MUST use markdown. Use **bold text** for emphasis. When providing multiple ideas, introduce them with a short, bolded title (e.g., "**Here are a few ideas, Tristen:**"). Use bullet points (* List item) or numbered lists (1. List item) for clarity. Use double line breaks between distinct points to create visual separation.
                4.  **Be a Coach:** Always end your responses with an open-ended, reflective question to encourage the manager to think deeper.
                5.  **Personalise:** Use the manager's name from the plan summary to build rapport.
                6.  **Context is Key:** Use the provided plan summary as your primary context. Do not reference it directly unless asked.

                Here is the plan summary:
                ---
                ${planSummary}
                ---
            `}],
        },
        {
            role: "model",
            parts: [{ text: "Understood. I have the manager's plan. I will provide concise, coach-like responses in British English. I will use markdown with bold titles for lists and double line breaks for spacing, and I will always end with a reflective question." }],
        },
        ...chatHistory
    ];

    const result = await model.startChat({ history }).sendMessage(userMessage);
    const response = await result.response;
    const aiText = response.text();

    return {
      statusCode: 200,
      body: JSON.stringify({ response: aiText }),
    };

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "The AI assistant is currently unavailable. Please try again later." }),
    };
  }
};
