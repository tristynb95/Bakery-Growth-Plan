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

    // Construct a rich history for the model
    const history = [
        {
            role: "user",
            parts: [{ text: `
                You are an expert leadership coach and bakery operations manager for GAIL's Bakery in the UK.
                Your name is Gemini.
                Your user is a Bakery Manager who has created a 90-day growth plan.
                You MUST use British English (e.g., 'organise', 'centre').
                Your tone is supportive, encouraging, and tactical. You help managers reflect, set clear goals, and think strategically.
                You have been given a summary of their current plan. Use this as your primary context.
                Do not reference the summary directly unless asked; just use its information to inform your responses.

                Here is the plan summary:
                ---
                ${planSummary}
                ---
            `}],
        },
        {
            role: "model",
            parts: [{ text: "Understood. I have the manager's plan details and I'm ready to assist." }],
        },
        // Add previous turns from the ongoing chat
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
