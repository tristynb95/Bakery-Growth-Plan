const admin = require('firebase-admin');
const busboy = require('busboy');

// --- Firebase Admin Initialization ---
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

const db = admin.firestore();
const bucket = admin.storage().bucket();

// --- Main Function Handler ---
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }
  if (!process.env.FIREBASE_SERVICE_ACCOUNT || !process.env.VITE_FIREBASE_STORAGE_BUCKET) {
    console.error('Missing required environment variables.');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error.' }) };
  }

  return new Promise((resolve, reject) => {
    const bb = busboy({
      headers: { 'content-type': event.headers['content-type'] || event.headers['Content-Type'] }
    });

    const fields = {};
    
    // --- Step 1: Handle text fields from the form ---
    bb.on('field', (name, val) => {
      fields[name] = val;
    });

    // --- Step 2: Handle the file stream ---
    bb.on('file', (name, file, info) => {
      const { filename, mimeType } = info;
      const filePath = `uploads/${fields.userId || 'unknown_user'}/${fields.planId || 'unknown_plan'}/${Date.now()}-${filename}`;
      const storageFile = bucket.file(filePath);
      
      const writeStream = storageFile.createWriteStream({
        metadata: { contentType: mimeType },
      });

      file.pipe(writeStream);

      writeStream.on('error', (err) => {
        console.error('Storage Write Stream Error:', err);
        reject({
          statusCode: 500,
          body: JSON.stringify({ error: `Failed to upload file to storage: ${err.message}` }),
        });
      });

      // --- Step 3: Once the file is uploaded, save its metadata to Firestore ---
      writeStream.on('finish', async () => {
        try {
          if (!fields.userId || !fields.planId) {
            throw new Error('User ID or Plan ID was not provided in the form data.');
          }

          await storageFile.makePublic();
          const publicUrl = storageFile.publicUrl();

          const fileMetadataRef = db.collection('users').doc(fields.userId)
                                    .collection('plans').doc(fields.planId)
                                    .collection('files');

          await fileMetadataRef.add({
            name: filename,
            url: publicUrl,
            storagePath: filePath,
            contentType: mimeType,
            uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          
          resolve({
            statusCode: 200,
            body: JSON.stringify({ message: 'File uploaded and metadata saved successfully!' }),
          });

        } catch (err) {
            console.error('Error saving metadata to Firestore:', err);
            reject({
              statusCode: 500,
              body: JSON.stringify({ error: `Could not finalize file upload: ${err.message}` }),
            });
        }
      });
    });

    bb.on('error', (err) => {
      console.error('Busboy Parsing Error:', err);
      reject({
        statusCode: 400,
        body: JSON.stringify({ error: `Error parsing form data: ${err.message}` }),
      });
    });
    
    // --- Final Step: Start the parsing process ---
    const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
    bb.end(body);

  }).catch(errorResponse => {
      // This ensures any promise rejection is properly returned as a response
      console.error('Function Promise Rejected:', errorResponse);
      return errorResponse;
  });
};

