// netlify/functions/generate-chat-response.js

const { GoogleGenerativeAI } = require("@google/generative-ai");

// (The formatCalendarDataForAI function remains the same, no changes needed there)
function formatCalendarDataForAI(calendarData, daysToLookBack = 0) {
    if (!calendarData || Object.keys(calendarData).length === 0) {
        return "The user's calendar is currently empty.";
    }
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - daysToLookBack);
    
    let calendarString = "Here is a summary of the user's upcoming calendar events:\n";
    if (daysToLookBack > 0) {
        calendarString = `Here is a summary of the user's calendar events from the last ${daysToLookBack} days and onwards:\n`
    }
    const sortedDates = Object.keys(calendarData).sort();
    
    const parts = [calendarString];
    for (const dateKey of sortedDates) {
        const eventDate = new Date(dateKey);
        if (eventDate >= startDate) {
            const events = calendarData[dateKey];
            if (events && events.length > 0) {
                const formattedDate = eventDate.toLocaleDateString('en-GB', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
                parts.push(`\n**${formattedDate}:**\n`);

                events.forEach(event => {
                    parts.push(`* **Event:** "${event.title}"\n  **Type:** ${event.type}\n`);
                    if (!event.allDay) {
                        if (event.timeFrom && event.timeTo) {
                            parts.push(`  **Time:** ${event.timeFrom} - ${event.timeTo}\n`);
                        } else if (event.timeFrom) {
                            parts.push(`  **Time:** ${event.timeFrom}\n`);
                        }
                    }
                });
            }
        }
    }
    return parts.join('');
}


exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { planSummary, chatHistory, userMessage, calendarData } = JSON.parse(event.body);
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest"}); // Note: Updated to a more recent model for best performance
    
    // For this example, let's assume the user wants to see the last 30 days plus the future.
    const calendarContext = formatCalendarDataForAI(calendarData, 30);
    
    // --- MODIFICATION START: Get and format the current date ---
    const today = new Date();
    const currentDateString = today.toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    // --- MODIFICATION END ---

    // The prompt has been enhanced to include the current date
    const history = [
        {
            role: "user",
            parts: [{ text: `
                You are an expert leadership coach and bakery operations manager for GAIL's Bakery in the UK. Your name is Gemini. Your user is a Bakery Manager.

                **Your Core Directives:**
                1.  **Language Style:** You MUST use simple, direct, and clear language. Be straight to the point. Avoid extravagant, complex, or overly-flowery vocabulary.
                2.  **Use British English:** You MUST use British English (e.g., 'organise', 'centre').
                3.  **Format with Markdown:** Use **bold text** for emphasis, and bullet points (* List item) or numbered lists for readability. Use double line breaks between points for spacing.
                4.  **Be a Coach:** When it is appropriate and adds value, end your response with an open-ended, reflective question. Do not do this after every response.
                5.  **Personalise Naturally:** Use the manager's name from the plan summary **occasionally and only where it feels natural** to build rapport. Do not use it in every response.
                6.  **Context is Key:** You have been given a summary of their current plan and their calendar. Use this as your primary context. If you don't have the information, state that clearly.
                7.  **Calendar Interpretation:** When the user asks about their 'shifts', 'rota', or when they are 'working', you MUST look for events in the provided calendar data with the type "my-shifts". This is how the user logs their work schedule. If you find matching events, list them clearly. If you don't, state that you can't see any shifts logged in their calendar.

                **Today's Date:**
                ---
                ${currentDateString}
                ---

                **Plan Summary:**
                ---
                ${planSummary}
                ---

                **Calendar Data:**
                ---
                ${calendarContext}
                ---
            `}],
        },
        {
            role: "model",
            parts: [{ text: "Understood. I will provide simple, direct, and coach-like responses in British English, using markdown and natural personalisation. I know what today's date is. I will interpret questions about shifts by looking for 'my-shifts' events in the calendar. I will only ask a reflective question when appropriate. If I don't know an answer, I will say so." }],
        },
        ...chatHistory
    ];
    
    const generationConfig = {
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 8192,
    };

    const chat = model.startChat({
        history,
        generationConfig,
    });

    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    const aiText = response.text();

    if (response.usageMetadata) {
      const { promptTokenCount, candidatesTokenCount } = response.usageMetadata;
      const totalTokenCount = promptTokenCount + candidatesTokenCount;

      console.log('--- AI Token Usage ---');
      console.log(`Input Tokens: ${promptTokenCount}`);
      console.log(`Output Tokens: ${candidatesTokenCount}`);
      console.log(`Total Tokens: ${totalTokenCount}`);
      console.log('----------------------');
    }

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
