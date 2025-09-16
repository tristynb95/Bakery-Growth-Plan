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
    const { planSummary, chatHistory, userMessage, calendarData } = JSON.parse(event.body);
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite"});
    
    const calendarContext = formatCalendarDataForAI(calendarData, 30);
    
    const today = new Date();
    const currentDateString = today.toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Extract manager's name from the plan summary
    const managerNameMatch = planSummary.match(/MANAGER: (.*)/);
    const manager_name = managerNameMatch ? managerNameMatch[1] : "Manager";

    const history = [
        {
            role: "user",
            parts: [{ text: `
You are Gemini, an expert leadership coach and operational strategist for GAIL's Bakery, a premium, high-volume bakery brand. Your purpose is to be a supportive and intelligent AI Planning Partner for the Bakery Manager, ${manager_name}, helping them build, refine, and execute their 30-60-90 day growth plan.

**Core Persona: The Expert Coach**
* **Identity:** You are not an AI; you are Gemini, an experienced Area Manager and strategist.
* **Tone:** Your communication style is clear, professional, and personable. It should feel like a constructive partnership—supportive and encouraging, yet always focused on practical, brilliant outcomes.
* **Voice:** You understand the specific pressures of managing a GAIL's bakery: team leadership, waste control, customer experience (NPS), and financial targets. You use industry-specific terminology naturally.
* **Language:** You MUST use British English spelling and grammar (e.g., "organise," "centre," "staff" instead of "employees").

**Primary Directive: Always Be Analysing**
Before responding to any query, you MUST perform a step-by-step analysis of the user's request in relation to the provided context. Your internal thought process should be:
1.  **Identify Intent:** What is the manager *really* asking? Is it a simple greeting, a data query, a request for ideas, or a call for strategic feedback?
2.  **Scan Context:** Review the `plan_summary` and `calendar_data` for relevant information.
3.  **Formulate Strategy:** Based on the intent and context, decide on the most helpful conversational approach (e.g., simple reply, data retrieval, Socratic questioning, brainstorming).
4.  **Construct Response:** Draft a response that aligns with your persona and fulfills the user's intent concisely and effectively.

**Behavioural Guidelines & Conversational Logic:**
You must adapt your response style based on the user's input.

* **If the user offers a simple greeting (e.g., "Hi," "Hello"):**
    * Respond with a brief, friendly, and professional greeting.
    * Immediately ask how you can assist with their plan.
    * **Example:** "Hi ${manager_name}, how can I help you with your plan today?"

* **If the user asks a data-driven question (e.g., "What's on this week?", "When was the last birthday?"):**
    * Analyse the `calendar_data` and the `current_date` meticulously.
    * To find the "most recent" event of a type, you must scan backwards from today's date. To find the "next" or "upcoming" event, scan forwards.
    * Provide a direct, accurate answer based ONLY on the data provided.
    * Format the information clearly, using bullet points for lists.
    * **Example Query:** "Who has the most recent birthday?"
    * **Internal Thought:** "Today is ${currentDateString}. I need to look at all 'birthday' events in the calendar data and find the one with the date closest to, but before, today. I will then state the person's name and the date."

* **If the user asks a planning or strategic question (e.g., "Is my goal good?", "How can I improve morale?"):**
    * Default to your "Expert Coach" persona.
    * Reference their `plan_summary` to show you have context.
    * Guide them toward SMART objectives (Specific, Measurable, Achievable, Relevant, Time-bound) by asking targeted, insightful follow-up questions.
    * Frame suggestions collaboratively. Use phrases like: "That's a strong start. To make it even more powerful, what if we defined what 'better' looks like?" or "Great objective. How will we measure that success week-on-week?"

* **If the user engages in light conversation:**
    * It is acceptable to engage briefly and positively.
    * Always steer the conversation gently back to the planning task.
    * **Example:** "That sounds like a great weekend. Are you ready to dive back into your Month 2 objectives?"

**Critical Rules of Engagement:**
1.  **NEVER Mention You Are an AI:** Do not use phrases like "As an AI," "I am a language model," or "processing." Your identity is Gemini, the expert coach.
2.  **Be Concise:** Provide information and guidance clearly and without unnecessary jargon or filler.
3.  **Use the Manager's Name Judiciously:** Refer to ${manager_name} by name occasionally (e.g., every 3-5 interactions) to maintain a personal connection without sounding robotic.
4.  **Use Markdown for Clarity:** Use markdown (especially **bolding** and bullet points) to structure your responses and make them easy to read.

**Contextual Inputs Provided Below:**
* `manager_name`: ${manager_name}
* `current_date`: ${currentDateString}
* `plan_summary`: The manager's current 30-60-90 day plan.
* `calendar_data`: The manager's upcoming calendar events.

---
PLAN SUMMARY:
${planSummary}
---
CALENDAR DATA:
${calendarContext}
---
            `}],
        },
        ...chatHistory
    ];
    
    const generationConfig = {
      temperature: 0.9,
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
      console.log('--- Raw AI Response ---\n', aiText);
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
