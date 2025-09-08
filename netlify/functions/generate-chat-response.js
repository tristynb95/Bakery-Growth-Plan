// netlify/functions/generate-chat-response.js

const { GoogleGenerativeAI } = require("@google/generative-ai");

// This is a placeholder for your Pinecone/knowledge base search function
async function searchKnowledgeBase(query) {
    console.log(`Searching knowledge base for: ${query}`);
    // In a real implementation, this would query your vector database.
    // We'll return an empty array to simulate the knowledge base not having an answer for a general query.
    return []; 
}

// This is a placeholder for a web search function
async function searchWeb(query) {
    console.log(`Searching the web for: ${query}`);
    // In a real implementation, you would use a tool like the Google Search API.
    // We'll return a placeholder result for demonstration.
    if (query.toLowerCase().includes("customer service award")) {
        return "The 'UK Customer Experience Awards' is a notable awards program in the UK, with entries typically opening in the spring and the awards ceremony in the autumn.";
    }
    return null;
}


exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { planSummary, chatHistory, userMessage } = JSON.parse(event.body);
    
    // --- RAG & Search Step ---
    const knowledgeContext = await searchKnowledgeBase(userMessage);
    const webContext = await searchWeb(userMessage);

    let context = "";
    if (knowledgeContext && knowledgeContext.length > 0) {
        context += "Here is some information from the GAIL's knowledge base:\n" + knowledgeContext.map(item => item.pageContent).join('\n\n');
    }
    if (webContext) {
        context += "\n\nHere is some information from a web search:\n" + webContext;
    }
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash"});

    // --- Final Augmented Prompt ---
    const augmentedPrompt = `
        You are Gemini, an expert leadership coach for Tristen, a Bakery Manager at GAIL's.
        Your tone is friendly, conversational, and supportive. Keep your responses concise and to the point.
        
        1.  First, review the provided CONTEXT to answer Tristen's question.
        2.  If the context is empty or irrelevant, use the provided PLAN SUMMARY and CHAT HISTORY to answer.
        3.  Always be helpful and conversational.
        
        CONTEXT:
        ---
        ${context || "No specific context found."}
        ---

        PLAN SUMMARY:
        ---
        ${planSummary}
        ---

        CHAT HISTORY:
        ---
        ${chatHistory.map(item => `${item.role}: ${item.parts[0].text}`).join('\n')}
        ---

        Based on all of the above, provide a concise, conversational response to Tristen's latest message: "${userMessage}"
    `;


    const result = await model.generateContent(augmentedPrompt);
    const response = await result.response;
    const aiText = response.text();

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
