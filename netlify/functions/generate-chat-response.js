// netlify/functions/generate-chat-response.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
/**
 * Formats calendar data for the AI, with a flexible look-back period.
 * @param {object} calendarData - The calendar data object.
 * @param {number} [daysToLookBack=0] - How many days into the past to include. Default is 0 (today onwards).
 * @returns {string} A formatted string of calendar events.
 */
function formatCalendarDataForAI(calendarData, daysToLookBack = 0) {
    if (!calendarData || Object.keys(calendarData).length === 0) {
        return "The user's calendar is currently empty.";
    }

    // --- MODIFICATION START ---
    // Calculate the start date for the look-back window
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0); // Start of today
    startDate.setDate(startDate.getDate() - daysToLookBack); // Subtract the look-back days
    // --- MODIFICATION END ---
    
    let calendarString = "Here is a summary of the user's upcoming calendar events:\n";
    if (daysToLookBack > 0) {
        calendarString = `Here is a summary of the user's calendar events from the last ${daysToLookBack} days and onwards:\n`
    }

    const sortedDates = Object.keys(calendarData).sort();
    
    for (const dateKey of sortedDates) {
        const eventDate = new Date(dateKey);
        
        // --- MODIFICATION START ---
        // Check if the event is within our new time window
        if (eventDate >= startDate) {
        // --- MODIFICATION END ---
            const events = calendarData[dateKey];
            if (events && events.length > 0) {
                const formattedDate = eventDate.toLocaleDateString('en-GB', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
                calendarString += `\n**${formattedDate}:**\n`;

                events.forEach(event => {
                    calendarString += `* **Event:** "${event.title}"\n  **Type:** ${event.type}\n`;
                    if (!event.allDay) {
                        if (event.timeFrom && event.timeTo) {
                            calendarString += `  **Time:** ${event.timeFrom} - ${event.timeTo}\n`;
                        } else if (event.timeFrom) {
                            calendarString += `  **Time:** ${event.timeFrom}\n`;
                        }
                    }
                });
            }
        }
    }
    return calendarString;
}

exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { planSummary, chatHistory, userMessage, calendarData } = JSON.parse(event.body);
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite"});
    
    const calendarContext = formatCalendarDataForAI(calendarData, 30);

    // --- ENHANCED PROMPT ---
    const history = [
        {
            role: "user",
            parts: [{ text: `
                You are an expert leadership coach and bakery operations manager for GAIL's Bakery in the UK. Your name is Gemini. Your user is a Bakery Manager.

                **Your Core Directives:**
                1.  **Language & Style:** You MUST use simple, direct, and clear British English (e.g., 'organise', 'centre'). Format responses with Markdown (**bold**, *italics*, bullet points). Be concise.
                2.  **Be a Coach:** When appropriate, end your response with an open-ended, reflective question to encourage deeper thinking. Do not do this every time.
                3.  **Personalise Naturally:** Use the manager's name from the plan summary occasionally and only where it feels natural to build rapport.
                4.  **Context is Key:** You have been given two pieces of context: a summary of their 90-day plan and a structured list of their calendar events. These are your primary sources of truth. If you don't have the information in the context, state that clearly.

                **Your Reasoning Process (Chain-of-Thought):**
                When a user asks a question, especially about events, people, or dates, you MUST follow this process:
                1.  **Analyse the Query:** Break down the user's question into key entities (e.g., names like 'Mya', keywords like 'review', 'training') and intent (e.g., 'find date', 'summarise goal').
                2.  **Perform a Semantic Search:** The user's query will NOT be an exact match. You must search for the *meaning* and *entities* within the calendar and plan data. For example, if the user asks for "Mya's review", you must find calendar entries containing both "Mya" and "review".
                3.  **Correlate Information:** Look for connections between the plan and the calendar. If the plan mentions a goal for a team member, and the calendar has an event for that team member, connect them in your response.
                4.  **Synthesise Your Answer:**
                    - If you find a direct match in the calendar, provide the full details (e.g., "I can see 'Mya: Team Leader Training Review' on your calendar for Monday, 8 September 2025.").
                    - If you cannot find a direct match in the calendar, state that, BUT then provide the closest related information from the plan. (e.g., "I can't see a specific date for Mya's review in your calendar, but your plan mentions she is due for sign-off in Month 3.").
                    - If you find nothing in either document, say so clearly.

                **Example Interaction:**
                *User Query:* "when was myas team leader training review?"
                *Your Internal Thought Process:* 1. Entities: 'Mya', 'review', 'training'. Intent: find date. 2. I will search the calendar for these keywords. 3. I see an event: "**Monday, 8 September 2025:** * Event: "Mya: Team Leader Training Review". This is a clear match. 4. I will state the event name and the full date.
                *Your Ideal Response:* "I can see Mya's Team Leader Training Review is on your calendar for **Monday, 8 September 2025**."

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
            parts: [{ text: "Understood. I will act as a GAIL's leadership coach. I will analyse user queries for entities and intent, semantically search both the plan and calendar, and provide correlated, direct answers in clear British English. If I can't find a direct answer, I'll provide the next best information." }],
        },
        ...chatHistory
    ];
    
    const generationConfig = {
      temperature: 0.7, // Slightly lower temp for more factual recall
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
