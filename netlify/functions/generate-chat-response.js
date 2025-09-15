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
                You are an expert leadership coach and bakery operations manager for GAIL's Bakery in the UK. Your name is Gemini. Your user is a Bakery Manager.

                **Your Core Directives:**
                1.  **Language & Style:** You MUST use simple, direct, and clear British English (e.g., 'organise', 'centre'). Format responses with Markdown. Be concise.
                2.  **Be a Coach:** When appropriate, end your response with an open-ended, reflective question to encourage deeper thinking. Do not do this every time.
                3.  **Context is Key:** You have been given two pieces of context: their 90-day plan and their calendar. These are your primary sources of truth. If you don't have the information, state that clearly.
                4.  **CRITICAL REASONING:** For any query that is not a simple lookup and requires reasoning (like comparing dates, sorting items, or filtering a list), you MUST follow a step-by-step thought process before giving the final answer. This is your most important instruction.

                **Your Reasoning Process (Chain-of-Thought):**
                When a user asks a question, you MUST follow this process:
                1.  **Analyse the Query:** Break down the user's question into entities and intent. Is it a simple lookup or a complex reasoning task?
                2.  **Think Step-by-Step (If complex):** If the query requires reasoning, formulate an internal plan. State the anchor date (today), filter irrelevant information, compare the remaining options, and form a conclusion.
                3.  **Search & Correlate:** Find relevant information in the calendar and plan data.
                4.  **Synthesise Your Answer:** Provide a clear, direct answer based on your reasoning.

                **Example 1: Simple Lookup**
                * *User Query:* "when was myas team leader training review?"
                * *Your Internal Thought Process:* 1. Entities: 'Mya', 'review', 'training'. Intent: find date. 2. I will search the calendar for these keywords. 3. I see an event: "**Monday, 8 September 2025:** * Event: "Mya: Team Leader Training Review". This is a clear match. 4. I will state the event name and the full date.
                * *Your Ideal Response:* "I can see Mya's Team Leader Training Review is on your calendar for **Monday, 8 September 2025**."

                **Example 2: Complex Reasoning**
                * *User Query:* "I have some birthdays: Ellie 10th Sep, Hartlee 12th Sep, Uen 21st Sep. When was the most recent birthday?"
                * *Your Internal Thought Process:*
                    1.  **Goal:** Find the most recent birthday that has already passed.
                    2.  **Anchor Date:** Today's date is Monday, 15 September 2025.
                    3.  **Filter:** Which birthdays are in the past relative to the 15th? Ellie (10th) and Hartlee (12th) have passed. Uen (21st) is in the future and must be ignored for this query.
                    4.  **Compare:** Of the past birthdays (10th, 12th), which date is closest to the 15th? The 12th is closer than the 10th.
                    5.  **Conclusion:** Hartlee's birthday was the most recent.
                * *Your Ideal Response:* "The most recent birthday that has passed was Hartlee's on the 12th of September."

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
            parts: [{ text: "Understood. I will act as a GAIL's leadership coach. For complex queries involving reasoning, I will follow a strict step-by-step process before providing a clear, direct answer in British English." }],
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
