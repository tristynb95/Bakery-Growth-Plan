// netlify/functions/search-knowledge-base.js

import { Pinecone } from '@pinecone-database/pinecone';

// This function will be expanded later to use the Gemini API for embeddings
async function getEmbeddings(text) {
    // Placeholder: In a real implementation, you would call the
    // Google Generative AI API here to convert the text to a vector.
    console.log(`Generating embedding for: ${text}`);
    // For now, we return a dummy vector of the correct dimension.
    // The embedding model 'text-embedding-004' uses 768 dimensions.
    return new Array(768).fill(0.5);
}

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { query } = JSON.parse(event.body);
        if (!query) {
            return { statusCode: 400, body: 'Query is required.' };
        }

        // Initialize Pinecone
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY,
        });

        const indexName = 'gails-knowledge-base'; // The name of the index you will create
        const index = pinecone.index(indexName);

        // Convert the user's query into a vector
        const queryEmbedding = await getEmbeddings(query);

        // Search the Pinecone index
        const queryResponse = await index.query({
            vector: queryEmbedding,
            topK: 3, // Get the top 3 most relevant results
            includeMetadata: true,
        });

        // Return the search results
        return {
            statusCode: 200,
            body: JSON.stringify(queryResponse.matches),
        };

    } catch (error) {
        console.error('Error searching knowledge base:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to search knowledge base.' }),
        };
    }
};
