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
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash"});

    // --- NEW, MORE DETAILED PROMPT FOR TABS ---
    const prompt = `
      You are an expert bakery operations manager tasked with creating a best-practice action plan from a manager's 90-day growth plan.
      Your output must be a clean, self-contained HTML structure with tabs.

      Instructions:
      1.  Analyze the provided 90-day plan.
      2.  Extract specific, actionable tasks from the "MUST-WIN BATTLE," "KEY LEVERS," and "PEOPLE GROWTH" sections for each month.
      3.  Group like items in a single month into 1 action (ie. "Izzy to complete kitchen training" and "Izzy to be in kitchen for 1 month" can be logically turned into a single action).
      4.  The final output MUST be a single HTML block. Do not include markdown or any other text.
      5.  The HTML structure must be as follows:
          - A main container div: <div class="ai-action-plan-container">
          - A tab navigation bar inside the container: <nav class="ai-tabs-nav">
          - Three anchor tags (<a>) inside the nav for the tabs: "Month 1", "Month 2", and "Month 3".
              - The first tab link should have the class "active".
              - Each tab link should have a "data-tab" attribute: "month1", "month2", "month3".
          - A tab content container div: <div class="ai-tabs-content">
          - Three tab panel divs inside the content container, one for each month.
              - The first panel should have the class "active".
              - Each panel should have a "data-tab-panel" attribute corresponding to the tab links: "month1", "month2", "month3".
          - Inside each tab panel, create an HTML table for that month's action steps.
      6.  Each table must have the following columns: "Action Step", "Owner", "Due Date", "Resources / Support Needed", and "Status".
      7.  For the "Owner", "Due Date", "Status", and "Resources / Support Needed" columns, leave the table cells (<td>) empty for the user to fill in.
      8.  If a specific month has no actionable items, generate the corresponding tab and an empty table. Do not omit the tab or panel.
      
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
