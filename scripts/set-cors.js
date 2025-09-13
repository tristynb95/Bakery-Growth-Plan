// set-cors.js
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

async function main() {
  try {
    const storage = new Storage();
    const bucketName = process.env.VITE_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      throw new Error('VITE_FIREBASE_STORAGE_BUCKET environment variable not set.');
    }

    const corsConfigFile = path.join(__dirname, '..', 'cors.json');
    const corsConfiguration = JSON.parse(fs.readFileSync(corsConfigFile, 'utf8'));

    await storage.bucket(bucketName).setCorsConfiguration(corsConfiguration);

    console.log(`Successfully set CORS configuration on bucket ${bucketName}`);
  } catch (error) {
    console.error('Error setting CORS configuration:', error);
    process.exit(1);
  }
}

main();
