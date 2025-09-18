import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import {
    getFirestore,
    collection,
    query,
    where,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import {
    getApp
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";

const app = getApp();
const db = getFirestore(app);
const auth = getAuth();

let currentUserId = null;
let currentPlanId = null;

// --- Main Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    const fileUploadForm = document.getElementById('file-upload-form');

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUserId = user.uid;
            // Extract planId from the URL, assuming it's a query parameter
            const urlParams = new URLSearchParams(window.location.search);
            currentPlanId = urlParams.get('planId');

            if (currentPlanId) {
                if (fileUploadForm) {
                    fileUploadForm.addEventListener('submit', handleFileUpload);
                }
                listenForFiles(currentUserId, currentPlanId);
            } else {
                console.error("Plan ID is missing from the URL.");
                // Optionally, disable the form or show a message
            }
        } else {
            console.log("User is not signed in.");
            // Handle signed-out state, maybe redirect to login
        }
    });
});

// --- File Upload Handler ---
async function handleFileUpload(event) {
    event.preventDefault();
    const fileInput = document.getElementById('file-input');
    const uploadStatus = document.getElementById('upload-status');

    if (!fileInput.files || fileInput.files.length === 0) {
        uploadStatus.textContent = 'Please select a file to upload.';
        uploadStatus.className = 'text-red-500';
        return;
    }

    const file = fileInput.files[0];
    const user = auth.currentUser;

    if (!user || !currentPlanId) {
        uploadStatus.textContent = 'Authentication error. Please sign in again.';
        uploadStatus.className = 'text-red-500';
        return;
    }

    uploadStatus.textContent = 'Preparing upload...';
    uploadStatus.className = 'text-blue-500';

    try {
        // --- Step 1: Get the secure, signed URL from our Netlify function ---
        const generateUrlResponse = await fetch('/.netlify/functions/generate-upload-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fileName: file.name,
                fileType: file.type,
                userId: user.uid,
                planId: currentPlanId,
            }),
        });

        if (!generateUrlResponse.ok) {
            throw new Error('Could not get a secure upload link.');
        }

        const {
            uploadUrl,
            storagePath
        } = await generateUrlResponse.json();

        // --- Step 2: Upload the file directly to Firebase Storage using the signed URL ---
        uploadStatus.textContent = 'Uploading file...';
        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': file.type,
            },
            body: file,
        });

        if (!uploadResponse.ok) {
            throw new Error('File upload failed.');
        }

        // --- Step 3: Save the file's metadata to Firestore via our second function ---
        uploadStatus.textContent = 'Finalizing...';
        const saveMetaResponse = await fetch('/.netlify/functions/save-file-metadata', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fileName: file.name,
                fileType: file.type,
                storagePath: storagePath,
                userId: user.uid,
                planId: currentPlanId,
            }),
        });

        if (!saveMetaResponse.ok) {
            throw new Error('Could not save file details.');
        }

        uploadStatus.textContent = 'Upload successful!';
        uploadStatus.className = 'text-green-500';
        fileInput.value = ''; // Clear the input field

    } catch (error) {
        console.error('File upload process failed:', error);
        uploadStatus.textContent = `Error: ${error.message}`;
        uploadStatus.className = 'text-red-500';
    }
}

// --- Real-time File Listener ---
function listenForFiles(userId, planId) {
    const filesList = document.getElementById('files-list');
    if (!filesList) return;

    const filesRef = collection(db, 'users', userId, 'plans', planId, 'files');
    const q = query(filesRef); // Can add orderBy here later if needed

    onSnapshot(q, (snapshot) => {
        filesList.innerHTML = ''; // Clear the list
        if (snapshot.empty) {
            filesList.innerHTML = '<p class="text-gray-500">No files uploaded yet.</p>';
            return;
        }
        snapshot.docs.forEach(doc => {
            const file = doc.data();
            const fileElement = document.createElement('div');
            fileElement.className = 'p-3 mb-2 bg-gray-100 rounded-lg flex justify-between items-center';
            fileElement.innerHTML = `
                <a href="${file.url}" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:underline">${file.name}</a>
                <span class="text-sm text-gray-500">${new Date(file.uploadedAt?.toDate()).toLocaleDateString()}</span>
            `;
            filesList.appendChild(fileElement);
        });
    }, (error) => {
        console.error("Error listening for file updates:", error);
        filesList.innerHTML = '<p class="text-red-500">Could not load files.</p>';
    });
}
