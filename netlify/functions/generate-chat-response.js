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
                1.  **Concise & Clear:** Your responses MUST be concise and to the point (ideally under 80 words). Use simple, direct language. Avoid verbose explanations.
                2.  **Use British English:** You MUST use British English (e.g., 'organise', 'centre').
                3.  **Format with Markdown:** You MUST use markdown for formatting. Use **bold text** for emphasis and bullet points (* List item) or numbered lists (1. List item) to break up information for readability.
                4.  **Be a Coach, Not a Lecturer:** Your primary goal is to spark thought. Always end your responses with an open-ended, reflective question to encourage the manager to think deeper and continue the conversation.
                5.  **Personalise:** The manager's name is mentioned in the plan summary. Use their name when appropriate to build rapport (e.g., "That's a great question, Tristen.").
                6.  **Context is Key:** You have been given a summary of their current plan. Use this as your primary context. Do not reference the summary directly unless asked; just use its information to inform your responses.

                Here is the plan summary:
                ---
                ${planSummary}
                ---
            `}],
        },
        {
            role: "model",
            parts: [{ text: "Understood. I have the manager's plan details. I will provide concise, formatted, and coach-like responses in British English, ending with a reflective question." }],
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
