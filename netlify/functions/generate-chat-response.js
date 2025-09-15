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
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite"});
    
    // For this example, let's assume the user wants to see the last 30 days plus the future.
    const calendarContext = formatCalendarDataForAI(calendarData, 30);

    // --- MODIFICATION START: The prompt has been significantly enhanced ---
    const history = [
        {
            role: "user",
            parts: [{ text: `
                You are an expert leadership coach. Your primary function is to process user queries and respond in a specific JSON format.

                **Your Core Directives:**
                1.  **Output Format:** You MUST ALWAYS respond with a valid JSON object. The object must have two keys: "internalReasoning" and "finalAnswer".
                2.  **internalReasoning:** This key's value must be a string containing your step-by-step analysis of the user's query, your search of the provided context, and your conclusion.
                3.  **finalAnswer:** This key's value must be a clean, user-facing string in clear British English, formatted with Markdown. This is the only part the user will see.
                4.  **Context is Key:** Base all your reasoning and answers on the Plan Summary and Calendar Data provided.

                **Example:**
                * *User Query:* "When was the most recent birthday? Birthdays are Ellie 10th Sep, Hartlee 12th Sep, Uen 21st Sep. Today is 15th Sep."
                * *Your REQUIRED JSON Output:*
                {
                  "internalReasoning": "The user wants the most recent past birthday. Today is Sep 15th. The past birthdays are Ellie (10th) and Hartlee (12th). Between the two, Hartlee's on the 12th is the most recent. The final answer should state this clearly.",
                  "finalAnswer": "The most recent birthday that has passed was **Hartlee's** on the 12th of September."
                }

                **Plan Summary Context:**
                ---
                ${planSummary}
                ---

                **Calendar Data Context:**
                ---
                ${calendarContext}
                ---
            `}],
        },
        {
            role: "model",
            parts: [{ text: `{
              "internalReasoning": "Understood. I will process all requests by reasoning internally and then providing the user-facing response in the 'finalAnswer' key of a JSON object.",
              "finalAnswer": "I'm ready to help. How can I assist you with your plan?"
            }` }],
        },
        ...chatHistory
    ];
    // --- MODIFICATION END ---
    
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

      let finalResponse;
    try {
      // The AI output is a string, which we need to parse into a JSON object.
      const parsedResponse = JSON.parse(aiText);
      finalResponse = parsedResponse.finalAnswer;
    } catch (e) {
      // If the AI fails to generate valid JSON, fall back to using its raw text.
      console.error("Failed to parse AI JSON response:", e);
      finalResponse = aiText;
    }

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
