const admin = require('firebase-admin');
const busboy = require('busboy');

// --- Firebase Admin Initialization ---
// Prevents re-initialization in "warm" function invocations
if (admin.apps.length === 0) {
  try {
    const serviceAccount = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf-8')
    );

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    });
  } catch (error) {
    console.error('Firebase Admin Initialization Error:', error);
    throw new Error('Firebase Admin SDK could not be initialized.');
  }
}

// --- Main Function Handler ---
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }
  if (!process.env.FIREBASE_SERVICE_ACCOUNT || !process.env.VITE_FIREBASE_STORAGE_BUCKET) {
    console.error('Missing required environment variables.');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error.' }) };
  }

  const bucket = admin.storage().bucket();

  return new Promise((resolve, reject) => {
    const bb = busboy({
      headers: { 'content-type': event.headers['content-type'] || event.headers['Content-Type'] }
    });

    bb.on('file', (name, file, info) => {
      const { filename, mimeType } = info;
      
      // Use a timestamp to ensure unique filenames
      const filePath = `uploads/${Date.now()}-${filename}`;
      const storageFile = bucket.file(filePath);
      const writeStream = storageFile.createWriteStream({
        metadata: {
          contentType: mimeType,
        },
      });

      file.pipe(writeStream);

      writeStream.on('error', (err) => {
        console.error('Storage Write Stream Error:', err);
        reject({
          statusCode: 500,
          body: JSON.stringify({ error: `Failed to upload file: ${err.message}` }),
        });
      });

      writeStream.on('finish', async () => {
        try {
          await storageFile.makePublic();
          const publicUrl = storageFile.publicUrl();
          
          resolve({
            statusCode: 200,
            body: JSON.stringify({
              message: 'File uploaded successfully!',
              fileUrl: publicUrl,
              fileName: filename,
            }),
          });
        } catch (err) {
            console.error('Error making file public or getting URL:', err);
            reject({
              statusCode: 500,
              body: JSON.stringify({ error: `Could not finalize file upload: ${err.message}` }),
            });
        }
      });
    });

    bb.on('error', (err) => {
      console.error('Busboy Error:', err);
      reject({
        statusCode: 400,
        body: JSON.stringify({ error: `Error parsing form data: ${err.message}` }),
      });
    });

    // Decode the body if it's base64 encoded by Netlify
    const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
    bb.end(body);
  }).catch(errorResponse => {
    // This catch block handles promise rejections from the new Promise constructor
    return errorResponse;
  });
};
