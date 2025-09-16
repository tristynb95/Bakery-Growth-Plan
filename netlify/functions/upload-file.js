const admin = require('firebase-admin');
const busboy = require('busboy');

// --- Firebase Admin Initialization ---
// Check if the app is already initialized to prevent errors in warm-lambda scenarios
if (admin.apps.length === 0) {
    try {
        // The service account key is stored in a Netlify environment variable
        // It should be the JSON content of the key file, base64-encoded
        const serviceAccount = JSON.parse(
            Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf-8')
        );

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
        });
    } catch (error) {
        console.error('Firebase Admin Initialization Error:', error);
        // We can't proceed without Firebase, so we'll throw to prevent the function from running
        throw new Error('Firebase Admin SDK could not be initialized.');
    }
}

// --- Helper function to parse the multipart form data ---
function parseMultipartForm(event) {
    return new Promise((resolve, reject) => {
        const bb = busboy({
            headers: { 'content-type': event.headers['content-type'] || event.headers['Content-Type'] }
        });

        const fields = {};
        const files = [];

        bb.on('file', (name, file, info) => {
            const { filename, encoding, mimeType } = info;
            const chunks = [];

            file.on('data', (chunk) => {
                chunks.push(chunk);
            });

            file.on('end', () => {
                files.push({
                    fieldname: name,
                    buffer: Buffer.concat(chunks),
                    filename,
                    encoding,
                    mimetype: mimeType,
                });
            });
        });

        bb.on('field', (name, value) => {
            fields[name] = value;
        });

        bb.on('finish', () => {
            resolve({ fields, files });
        });

        bb.on('error', (err) => {
            reject(new Error(`Error parsing form: ${err.message}`));
        });

        // The event body needs to be decoded if it's base64 encoded by Netlify
        const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
        bb.end(body);
    });
}


// --- Main Function Handler ---
exports.handler = async function(event, context) {
    // 1. Basic checks
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }
    if (!process.env.FIREBASE_SERVICE_ACCOUNT || !process.env.VITE_FIREBASE_STORAGE_BUCKET) {
        console.error('Missing required environment variables.');
        return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error.' }) };
    }

    try {
        // 2. Parse the incoming multipart/form-data
        const { files } = await parseMultipartForm(event);

        if (!files || files.length === 0) {
            return { statusCode: 400, body: JSON.stringify({ error: 'No file uploaded.' }) };
        }

        const uploadedFile = files[0];
        const bucket = admin.storage().bucket();

        // 3. Create a reference in Firebase Storage
        // Use a timestamp to ensure unique filenames and prevent overwrites
        const filePath = `uploads/${Date.now()}-${uploadedFile.filename}`;
        const file = bucket.file(filePath);

        // 4. Upload the file buffer
        await file.save(uploadedFile.buffer, {
            metadata: {
                contentType: uploadedFile.mimetype,
            },
        });

        // 5. Make the file public and get its URL
        await file.makePublic();
        const publicUrl = file.publicUrl();

        // 6. Return a success response
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'File uploaded successfully!',
                fileUrl: publicUrl,
                fileName: uploadedFile.filename,
            }),
        };

    } catch (error) {
        console.error('Upload Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `An unexpected error occurred: ${error.message}` }),
        };
    }