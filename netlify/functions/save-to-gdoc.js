// File: netlify/functions/save-to-gdoc.js

const { google } = require('googleapis');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { content } = JSON.parse(event.body);
        if (!content) {
            return { statusCode: 400, body: 'JSON body with "content" key is required.' };
        }

        // 1. Authenticate with Google
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/documents'],
        });

        const authClient = await auth.getClient();

        // 2. Initialize the Google Docs API client
        const docs = google.docs({
            version: 'v1',
            auth: authClient,
        });

        // 3. Create the document with a title
        const createResponse = await docs.documents.create({
            resource: {
                title: 'Bakery Growth Plan',
            },
        });

        const documentId = createResponse.data.documentId;

        // 4. Insert the content into the new document
        await docs.documents.batchUpdate({
            documentId,
            resource: {
                requests: [
                    {
                        insertText: {
                            location: {
                                index: 1,
                            },
                            text: content,
                        },
                    },
                ],
            },
        });
        
        // 5. Generate a link to the new document
        const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                message: 'Successfully created Google Doc!',
                url: docUrl
            }),
        };

    } catch (error) {
        console.error('Error creating Google Doc:', error.response ? error.response.data : error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to create Google Doc.',
                details: error.response ? error.response.data.error.message : error.message,
            }),
        };
    }
};
