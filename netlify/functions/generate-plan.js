const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const planSummary = JSON.parse(event.body).planSummary;
    
    // Securely get the API key from the environment variables you set in Netlify
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});

    // --- NEW, MORE DETAILED PROMPT ---
    const prompt = `
      You are an expert bakery operations manager tasked with creating a best-practice action plan from a manager's 90-day growth plan.
      Your output must be a clean HTML table.

      Instructions:
      1.  Analyze the provided 90-day plan.
      2.  Extract specific, actionable tasks from the "MUST-WIN BATTLE," "KEY LEVERS," and "PEOPLE GROWTH" sections for each month.
      3.  Present these tasks in an HTML table with a title for each month (e.g., <h2>Month 1 Action Plan</h2>). Group like items in a single month into 1 action (ie. "Izzy to complete kitchen training" and "Izzy to be in kitchen for 1 month" can be logically turned into a single action)
      4.  The table must have the following columns: "Action Step", "Owner", "Due Date", "Resources / Support Needed", and "Status".
      5.  For the "Owner" column leave it blank for the user to fill in.
      6.  For the "Due Date" column leave it blank for the user to fill in.
      7.  For the "Status" column, leave it blank for the user to fill in.
      8. For the "Resources / Support Needed", leave it blank for the user to fill in
      9.  The entire output should be only the HTML for the tables, starting with an <h2> title. Do not include markdown or any other text.

      Here is the plan to analyze:
      ---
      ${planSummary}
      ---
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const aiText = response.text();

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
