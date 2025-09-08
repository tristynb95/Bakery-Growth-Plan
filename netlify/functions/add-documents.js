// netlify/functions/add-documents.js

import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize clients
const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
});
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// This function splits a large document into smaller, manageable chunks.
function splitText(text, chunkSize = 500, overlap = 50) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
        const end = Math.min(i + chunkSize, text.length);
        chunks.push(text.slice(i, end));
        i += chunkSize - overlap;
    }
    return chunks;
}

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { documentText, documentId } = JSON.parse(event.body);
        if (!documentText || !documentId) {
            return { statusCode: 400, body: 'documentText and documentId are required.' };
        }

        // --- 1. Split Document ---
        const textChunks = splitText(documentText);

        // --- 2. Create Embeddings ---
        const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const embeddingsResult = await embeddingModel.batchEmbedContents({
            requests: textChunks.map(chunk => ({ content: chunk, taskType: "RETRIEVAL_DOCUMENT" })),
        });
        const embeddings = embeddingsResult.embeddings.map(e => e.values);

        // --- 3. Prepare Vectors for Pinecone ---
        const vectors = textChunks.map((chunk, i) => ({
            id: `${documentId}-chunk-${i}`,
            values: embeddings[i],
            metadata: {
                docId: documentId,
                text: chunk,
            },
        }));

        // --- 4. Upsert (Upload) to Pinecone ---
        const indexName = 'gails-knowledge-base';
        const index = pinecone.index(indexName);
        await index.upsert(vectors);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: `Successfully added ${vectors.length} chunks from document ${documentId}.` }),
        };

    } catch (error) {
        console.error('Error adding document:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to add document to knowledge base.' }),
        };
    }
};
