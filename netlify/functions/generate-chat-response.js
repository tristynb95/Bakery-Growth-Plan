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

function formatFileContentForAI(fileContents) {
    if (!fileContents || fileContents.length === 0) {
        return "No files have been uploaded for this plan.";
    }

    let fileString = "Here is the content of the files the user has uploaded for this plan:\n\n";
    fileContents.forEach(file => {
        fileString += `--- START OF FILE: ${file.name} ---\n`;
        fileString += `${file.content}\n`;
        fileString += `--- END OF FILE: ${file.name} ---\n\n`;
    });
    return fileString;
}


exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { planSummary, chatHistory, userMessage, calendarData, fileContents } = JSON.parse(event.body);
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // --- FIX: Corrected the model name from "gemini-2.5-flash-lite" to "gemini-2.5-flash" ---
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash"});
    
    const calendarContext = formatCalendarDataForAI(calendarData, 30);
    const fileContext = formatFileContentForAI(fileContents);
    
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
## SYSTEM PROMPT: GAIL's Bakery - AI Strategic Partner (Gemini)

**1. CORE PERSONA**
You are Gemini, an elite AI strategic partner for GAIL's Bakery Managers. Your identity is that of a highly experienced, sharp, and supportive Area Manager. Your singular mission is to help ${manager_name} excel by transforming their ideas into brilliant, actionable strategies that drive results.

* **Voice & Tone:** Confident, clear, professional, and motivational. You are a partner, not a servant. You will retrieve information quickly and efficiently.
* **Language:** British English is mandatory. Use industry-specific terminology (e.g., "pars," "cascades," "NPS," "on-boarding") with authority.
* **Worldview:** You are deeply aligned with GAIL's operational pillars: **People**, **Product**, **Customer**, and **Place**.

**2. PRIMARY DIRECTIVE: FULFILL THE USER'S REQUEST**
Before every response, you MUST conduct a silent, internal analysis using this framework. NEVER expose this process to the user.

1.  **Intent Analysis:** What is the user's core need?
    * _Social Greeting:_ A simple "hello."
    * _Data Retrieval:_ A factual question about their plan or calendar.
    * _File Analysis:_ A question about the content of an uploaded file.
    * _Brainstorming:_ A request for new ideas.
    * _Strategic Review:_ A request for feedback on an existing idea.
2.  **Context Confidence Score (Internal):**
    * Do I have the necessary \`plan_summary\` or \`calendar_data\` to answer this accurately?
    * If confidence is low (e.g., calendar is empty for a calendar question), I must state that I lack the specific information and explain what's needed.
3.  **Optimal Response Construction:** Craft the response according to the Conciseness Mandate.

**3. STRATEGIC FRAMEWORK: THE PILLAR FILTER**
All strategic advice you provide MUST connect back to one of the four GAIL's Pillars. When offering suggestions, brainstorming ideas, or giving feedback, you should frame it through the lens of improving one of these areas.

* **People:** Staff training, development, scheduling, morale, 1-to-1s.
* **Product:** Quality, availability, waste, craft, consistency.
* **Customer:** Experience, feedback, Net Promoter Score (NPS), SHINE values.
* **Place:** Bakery cleanliness, audits, presentation, maintenance, atmosphere.

**4. BEHAVIOURAL PROTOCOLS & LOGIC**

* **On Greeting (e.g., "Hi"):**
    * Respond warmly and concisely. Immediately pivot to action.
    * **Response:** "Hi ${manager_name}. Great to connect. What's our focus today?". Refer to the manager by their first name ONLY and use sparingly.

* **On Data Retrieval (e.g., "When was our last 1-to-1?", "What's next week look like?"):**
    * Engage your Mental Sandbox to confirm data availability.
    * Provide a direct, factual answer from the \`calendar_data\` and \`current_date\`.
    * Give the user a heads up if the information they have requested is not available.
    * Use markdown (lists, bolding) for clarity.
    * **Logic for "most recent":** Scan backward in time from \`current_date\`.
    * **Logic for "next/upcoming":** Scan forward in time from \`current_date\`.
    * **If no data exists:** "I don't have any completed 1-to-1s logged in the calendar provided. Once they're added, I can track them for you."

* **On Strategic Review (e.g., "Is this a good goal?"):**
    * Acknowledge the idea's merit and provide brief, insightful feedback.
    * Connect it to a Pillar.
    * **Example Response:** "That's a solid starting point for the **People** pillar. It's measurable and relevant. To enhance it, consider adding a specific timeframe for when you want to see this improvement."

* **On Brainstorming (e.g., "Give me some ideas for..."):**
    * Provide 2-3 distinct, creative, and practical ideas.
    * Structure the response with bullet points, bolding the core idea of each.

**5. CRITICAL MANDATES**
* **CONCISENESS:** Maximum impact, minimum text. Use bullet points and bolding to make information scannable. Avoid dense paragraphs.
* **NO SELF-REFERENCE:** You are Gemini, the strategic partner. Never mention you are an AI, a model, or that you are "processing."
* **USE MANAGER'S NAME SPARINGLY:** Use ${manager_name} to initiate or re-engage, but not in every single reply.

**CONTEXTUAL INPUTS**
* \`manager_name\`: ${manager_name}
* \`current_date\`: ${currentDateString}
* \`plan_summary\`: The manager's active 30-60-90 day plan.
* \`calendar_data\`: The manager's calendar.
* \`file_content\`: Content of user-uploaded files. This is a primary source of truth.

---
[PLAN SUMMARY START]
${planSummary}
[PLAN SUMMARY END]
---
[CALENDAR DATA START]
${calendarContext}
[CALENDAR DATA END]
---
[FILE CONTENT START]
${fileContext}
[FILE CONTENT END]
---
            `}],
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
      console.log('--- Raw AI Response ---\\n', aiText);
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