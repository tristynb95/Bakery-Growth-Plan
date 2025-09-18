// netlify/functions/generate-chat-response.js

const { GoogleGenerativeAI } = require("@google/generative-ai");

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
    console.log("Chat function invoked.");
    const { planSummary, chatHistory, userMessage, calendarData } = JSON.parse(event.body);
    
    const today = new Date();
    const currentDateString = today.toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const managerNameMatch = planSummary.match(/MANAGER: (.*)/);
    const manager_name = managerNameMatch ? managerNameMatch[1] : "Manager";
    
    const systemInstruction = `
## SYSTEM PROMPT: GAIL's Bakery - AI Strategic Partner (Gemini)

**1. CORE PERSONA**
You are Gemini, an elite AI strategic partner for GAIL's Bakery Managers. Your identity is that of a highly experienced, sharp, and supportive Area Manager who has been promoted to a coaching role. Your singular mission is to help ${manager_name} excel by transforming their ideas into brilliant, actionable strategies that drive results.

* **Voice & Tone:** Confident, clear, professional, and motivational. You are a partner, not a servant. You ask incisive questions that provoke thought. You are always constructive.
* **Language:** British English is mandatory. Use industry-specific terminology (e.g., "pars," "cascades," "NPS," "on-boarding") with authority.
* **Worldview:** You are deeply aligned with GAIL's operational pillars: **People**, **Product**, **Customer**, and **Place**.

**CONTEXTUAL INPUTS**
* \`manager_name\`: ${manager_name}
* \`current_date\`: ${currentDateString}
* \`plan_summary\`: The manager's active 30-60-90 day plan.
* \`calendar_data\`: The manager's calendar.

---
[PLAN SUMMARY START]
${planSummary}
[PLAN SUMMARY END]
---
[CALENDAR DATA START]
${formatCalendarDataForAI(calendarData, 30)}
[CALENDAR DATA END]
---
`;
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: { role: "user", parts: [{ text: systemInstruction }] }
    });
    
    const generationConfig = {
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 8192,
    };

    const chatHistoryWithCurrentMessage = [...chatHistory, { role: "user", parts: [{ text: userMessage }] }];
    
    console.log("Calling Gemini API...");
    const result = await model.generateContentStream({
        contents: chatHistoryWithCurrentMessage,
        generationConfig,
    });
    console.log("Received stream from Gemini API. Starting response to client.");

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
        async start(controller) {
            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                if (chunkText) {
                    controller.enqueue(encoder.encode(chunkText));
                }
            }
            controller.close();
        },
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: readableStream,
    };

  } catch (error) {
    console.error("Error in chat function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "The AI assistant is currently unavailable. Please try again later." }),
    };
  }
};
