// netlify/functions/generate-plan.js

const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { planSummary, monthToGenerate } = JSON.parse(event.body);
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // --- DYNAMIC PROMPT LOGIC ---
    const isSingleMonth = monthToGenerate && parseInt(monthToGenerate, 10) > 0;

    const primaryGoal = isSingleMonth
      ? `Generate a clean, self-contained HTML table for Month ${monthToGenerate}. The output MUST be only the <table>...</table> block, ready to be injected into an existing HTML structure.`
      : `Generate a clean, self-contained HTML structure with tabs and three tables (one for each month).`;

    const analysisInstruction = isSingleMonth
      ? `Analyse the provided plan summary specifically for Month ${monthToGenerate}. Group similar or related tasks into single, actionable steps.`
      : `Analyse the provided plan summary for Month 1, Month 2, and Month 3. Group similar or related tasks into single, actionable steps.`;
    
    const thoughtProcess = isSingleMonth
      ? `1. I will read the summary for Month ${monthToGenerate} to understand its key objectives.
         2. I will extract the tasks and goals for this specific month.
         3. I will consolidate related tasks into concise action steps.
         4. For each step, I will determine the most appropriate Pillar.
         5. I will construct ONLY the HTML <table> element for this month, leaving 'Status' cells empty.`
      : `1. I will read the entire 90-day plan summary.
         2. For each of the three months, I will extract tasks and goals.
         3. I will consolidate related tasks into concise action steps.
         4. For each action step, I will determine the most appropriate Pillar.
         5. I will construct the complete HTML response with the full tab structure for all three months.`;

    const outputExample = isSingleMonth
      ? `<table><thead>...</thead><tbody>...</tbody><tfoot>...</tfoot></table>`
      : `<div class="ai-action-plan-container">... (full tab structure) ...</div>`;

    const prompt = `
      You are an expert bakery operations manager. Your task is to create a best-practice, tactical action plan from a manager's growth plan summary.

      **Primary Goal:** ${primaryGoal}

      **Core Instructions:**
      1.  **Language**: You MUST use British English spelling and grammar (e.g., 'organise', 'centre').
      2.  **Analyse & Group**: ${analysisInstruction}
      3.  **Assign Pillars**: For each action step, you MUST assign one of the four pillars: People, Customer, Product, or Place.
      4.  **Strict HTML Structure**: The final output MUST be ONLY the HTML code block. Do not include markdown formatting like \`\`\`html.
      5.  **Manager's Name**: When referring to the manager in the action plan, use the manager name found in the summary.
      6.  **Responses**: Your responses will be clear, concise and actionable.

      **Step-by-Step Thought Process (Chain-of-Thought):**
      ${thoughtProcess}

      **Output Format Example:**
      ${outputExample}

      Here is the plan to analyse:
      ---
      ${planSummary}
      ---
    `;
    
    const generationConfig = {
      temperature: 0.2,
      topK: 1,
      topP: 1,
      maxOutputTokens: 8192,
    };

    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig,
    });
    
    const response = await result.response;
    let aiText = response.text();
    aiText = aiText.replace(/^```(html)?\s*/, '').replace(/```$/, '').trim();

    return {
      statusCode: 200,
      body: JSON.stringify({ actionPlan: aiText }),
    };

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to generate AI plan." }),
    };
  }
};