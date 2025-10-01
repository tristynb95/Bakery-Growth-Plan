const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { planSummary } = JSON.parse(event.body);
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest"});

    // --- OPTIMIZED PROMPT ---
    const prompt = `
      You are an expert bakery operations manager for GAIL's Bakery. Your task is to create a tactical action plan from the provided 90-day growth plan summary.

      **CRITICAL INSTRUCTIONS:**
      1.  **Language**: Use British English spelling and grammar (e.g., 'organise').
      2.  **Pillar Assignment**: For each action, you MUST assign one of four pillars: People, Customer, Product, or Place.
      3.  **Consolidate Tasks**: Group related tasks into single, clear, actionable steps.
      4.  **HTML Output Only**: Your response MUST be ONLY the HTML code. Do not include markdown formatting like \`\`\`html.
      5.  **Structure**: Generate a self-contained HTML structure with tabs for each of the 3 months. Each tab should contain a table with the following columns: "Action Step", "Pillar", "Owner", "Due Date", "Resources / Support Needed", and "Status". Leave the "Status" cell empty. Each row must include an actions cell with a remove button. The table footer should contain an "Add Row" button.

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

    const response = result.response;
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