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
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest"});
    
    const calendarContext = formatCalendarDataForAI(calendarData, 30);
    
    const today = new Date();
    const currentDateString = today.toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // --- MODIFICATION: System prompt now includes Chain-of-Thought instructions ---
    const history = [
        {
            role: "user",
            parts: [{ text: `
                You are an expert leadership coach and bakery operations manager for GAIL's Bakery in the UK. Your name is Gemini. Your user is a Bakery Manager.

                **Your Core Directives:**
                1.  **Reasoning:** First, think step-by-step about the user's request, the provided context (plan, calendar), and your directives. Enclose this internal monologue within <thinking>...</thinking> tags.
                2.  **Final Answer:** After your reasoning, formulate the final, user-facing response. Enclose this complete response within <final_answer>...</final_answer> tags. The user will ONLY see what is inside the <final_answer> tags.
                3.  **Language Style:** Use simple, direct, and clear language in your final answer. Be straight to the point.
                4.  **Use British English:** You MUST use British English (e.g., 'organise', 'centre').
                5.  **Format with Markdown:** Use **bold text**, bullet points, and numbered lists for readability.
                6.  **Be a Coach:** When appropriate, end your final answer with an open-ended, reflective question.
                7.  **Personalise Naturally:** Use the manager's name from the plan summary occasionally and only where it feels natural.
                8.  **Context is Key:** Base your reasoning and final answer on the provided plan summary and calendar. If you don't have the information, state that clearly in your final answer.
                9.  **Calendar Interpretation:** When the user asks about 'shifts' or 'rota', look for events with the type "my-shifts".

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
            parts: [{ text: "<thinking>The user has provided their core instructions. I need to acknowledge them and confirm my process. I will always use the <thinking> and <final_answer> tags as requested. My primary goal is to provide clear, coach-like advice based on the context provided, formatted correctly, and in British English.</thinking><final_answer>Understood. I will provide simple, direct, and coach-like responses in British English. I will always reason through my response first, then provide the final answer which is the only part you will see. I know today's date and will interpret questions about shifts by looking for 'my-shifts' events in the calendar.</final_answer>" }],
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
    const rawAiText = response.text();

    // --- MODIFICATION: Extract only the final answer for the user ---
    let finalResponse = rawAiText; // Default to the full response as a fallback
    const match = rawAiText.match(/<final_answer>([\s\S]*?)<\/final_answer>/);

    if (match && match[1]) {
        finalResponse = match[1].trim();
    } else {
        // If the model fails to use the tags, we can log it for debugging
        // while still sending a potentially usable (though messy) response.
        console.warn("AI response did not contain <final_answer> tags. Returning raw response.");
    }
    // --- END MODIFICATION ---

    if (response.usageMetadata) {
      const { promptTokenCount, candidatesTokenCount } = response.usageMetadata;
      const totalTokenCount = promptTokenCount + candidatesTokenCount;

      console.log('--- AI Token Usage ---');
      console.log(`Input Tokens: ${promptTokenCount}`);
      console.log(`Output Tokens: ${candidatesTokenCount}`);
      console.log(`Total Tokens: ${totalTokenCount}`);
      // Log the raw response to see the "thinking" part on the server
      console.log('--- Raw AI Response ---\n', rawAiText);
      console.log('----------------------');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ response: finalResponse }), // Send only the extracted text
    };

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "The AI assistant is currently unavailable. Please try again later." }),
    };
  }
};
