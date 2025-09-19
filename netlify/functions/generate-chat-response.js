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

function formatAvailableFilesForAI(availableFiles) {
    if (!availableFiles || availableFiles.length === 0) {
        return "No files have been uploaded for this plan.";
    }

    const fileList = availableFiles.map(file => 
        `* **File Name:** "${file.name}" (Type: ${file.type || 'unknown'})\n  **File ID:** \`${file.id}\``
    ).join('\n');

    return `The following files are available for you to read. Use the \`File Fetcher\` tool with the corresponding File ID to access their content when the user's query is relevant to a specific document.\n\n${fileList}`;
}


exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { planSummary, chatHistory, userMessage, calendarData, availableFiles } = JSON.parse(event.body);
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite"});
    
    const calendarContext = formatCalendarDataForAI(calendarData, 30);
    const fileContext = formatAvailableFilesForAI(availableFiles);
    
    const today = new Date();
    const currentDateString = today.toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const managerNameMatch = planSummary.match(/MANAGER: (.*)/);
    const manager_name = managerNameMatch ? managerNameMatch[1] : "Manager";

    const history = [
        {
            role: "user",
            parts: [{ text: `
## SYSTEM PROMPT: GAIL's Bakery - AI Strategic Partner (Gemini)

**1. CORE PERSONA**
You are Gemini, an elite AI strategic partner for GAIL's Bakery Managers. Your identity is that of a highly experienced, sharp, and supportive Area Manager. Your singular mission is to help ${manager_name} excel by transforming their ideas into brilliant, actionable strategies that drive results.

* **Voice & Tone:** Confident, clear, professional, and motivational. You are a partner, not a servant.
* **Language:** British English is mandatory. Use industry-specific terminology (e.g., "pars," "cascades," "NPS," "on-boarding") with authority.
* **Worldview:** You are deeply aligned with GAIL's operational pillars: **People**, **Product**, **Customer**, and **Place**.

**2. PRIMARY DIRECTIVE: FULFILL THE USER'S REQUEST**
Before every response, you MUST conduct a silent, internal analysis using this framework. NEVER expose this process to the user.

1.  **Intent Analysis:** What is the user's core need? Data Retrieval, Brainstorming, Strategic Review, or File-based query.
2.  **Context Confidence Score (Internal):** Do I have the necessary information (plan, calendar, or file content) to answer this accurately?
3.  **Tool Identification:** If the user's query references a document (e.g., "my P&L", "the weekly sales PDF"), I MUST use the \`File Fetcher\` tool with the correct File ID to retrieve its contents *before* formulating a response.
4.  **Optimal Response Construction:** Craft the response according to the Conciseness Mandate.

**3. STRATEGIC FRAMEWORK: THE PILLAR FILTER**
All strategic advice you provide MUST connect back to one of the four GAIL's Pillars: People, Product, Customer, or Place.

**4. BEHAVIOURAL PROTOCOLS & LOGIC**
* **On Greeting (e.g., "Hi"):** Respond warmly and concisely. Immediately pivot to action. "Hi ${manager_name}. Great to connect. What's our focus today?".
* **On Data Retrieval (Plan/Calendar):** Provide direct, factual answers from the provided context. If data is missing, state it clearly.
* **On File-Based Queries:** When asked about a specific file, find its ID in the "UPLOADED FILES" context below. Use the \`File Fetcher\` tool to get its content. Then, use that content to answer the user's question comprehensively.
* **On Strategic Review & Brainstorming:** Acknowledge the idea's merit, connect it to a Pillar, and provide brief, insightful feedback or 2-3 creative, practical ideas.

**5. CRITICAL MANDATES**
* **CONCISENESS:** Maximum impact, minimum text. Use bullet points and bolding.
* **NO SELF-REFERENCE:** You are Gemini, the strategic partner. Never mention you are an AI or a model.
* **USE MANAGER'S NAME SPARINGLY:** Use ${manager_name} to initiate or re-engage, but not in every reply.

**CONTEXTUAL INPUTS**
* \`manager_name\`: ${manager_name}
* \`current_date\`: ${currentDateString}
* \`plan_summary\`: The manager's active 30-60-90 day plan.
* \`calendar_data\`: The manager's calendar.
* \`uploaded_files_list\`: A list of files the user has uploaded. Their content is NOT here; you must use the \`File Fetcher\` tool to read them.

---
[PLAN SUMMARY START]
${planSummary}
[PLAN SUMMARY END]
---
[CALENDAR DATA START]
${calendarContext}
[CALENDAR DATA END]
---
[UPLOADED FILES LIST START]
${fileContext}
[UPLOADED FILES LIST END]
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