let db;
let storage;
let auth;
let appState;

export function initializeFiles(database, storageInstance, state, authInstance) {
    db = database;
    storage = storageInstance;
    appState = state;
    auth = authInstance;
}

let currentUserId = null;
let currentPlanId = null;
let fileUnsubscribe = null; // To stop listening to old file lists

// This is the function that plan-view.js is looking for. We now export it.
export function showFilesView() {
    const fileUploadForm = document.getElementById('file-upload-form');

    // We only need to run this setup once when the view is shown.
    const user = auth.currentUser;
    if (user) {
        currentUserId = user.uid;
        const urlParams = new URLSearchParams(window.location.search);
        currentPlanId = urlParams.get('planId');

        if (currentPlanId) {
            if (fileUploadForm) {
                // A simple way to prevent adding the same listener multiple times
                if (!fileUploadForm.hasAttribute('data-submit-listener')) {
                    fileUploadForm.addEventListener('submit', handleFileUpload);
                    fileUploadForm.setAttribute('data-submit-listener', 'true');
                }
            }
            listenForFiles(currentUserId, currentPlanId);
        } else {
            console.error("Plan ID is missing from the URL.");
            document.getElementById('files-list').innerHTML = '<p class="text-red-500">Could not load files: Plan ID is missing.</p>';
        }
    } else {
        console.log("User is not signed in.");
        document.getElementById('files-list').innerHTML = '<p class="text-red-500">Please sign in to view files.</p>';
    }
}

async function handleFileUpload(event) {
    event.preventDefault();
    const fileInput = document.getElementById('file-input');
    const uploadStatus = document.getElementById('upload-status'); // Let's add a status element

    if (!fileInput.files || fileInput.files.length === 0) {
        if(uploadStatus) uploadStatus.textContent = 'Please select a file to upload.';
        return;
    }

    const file = fileInput.files[0];
    const user = auth.currentUser;

    if (!user || !currentPlanId) {
        if(uploadStatus) uploadStatus.textContent = 'Authentication error. Please sign in again.';
        return;
    }

    if(uploadStatus) uploadStatus.textContent = 'Preparing upload...';

    try {
        // Step 1: Get the secure, signed URL
        const generateUrlResponse = await fetch('/.netlify/functions/generate-upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName: file.name,
                fileType: file.type,
                userId: user.uid,
                planId: currentPlanId,
            }),
        });

        if (!generateUrlResponse.ok) {
            const errorData = await generateUrlResponse.json();
            throw new Error(errorData.error || 'Could not get a secure upload link.');
        }

        const { uploadUrl, storagePath } = await generateUrlResponse.json();

        // Step 2: Upload the file directly to Firebase Storage
        if(uploadStatus) uploadStatus.textContent = 'Uploading file...';
        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file,
        });

        if (!uploadResponse.ok) {
            throw new Error('File upload to storage failed.');
        }

        // Step 3: Save the file's metadata to Firestore
        if(uploadStatus) uploadStatus.textContent = 'Finalizing...';
        const saveMetaResponse = await fetch('/.netlify/functions/save-file-metadata', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName: file.name,
                fileType: file.type,
                storagePath: storagePath,
                userId: user.uid,
                planId: currentPlanId,
            }),
        });

        if (!saveMetaResponse.ok) {
            const errorData = await saveMetaResponse.json();
            throw new Error(errorData.error || 'Could not save file details.');
        }

        if(uploadStatus) uploadStatus.textContent = 'Upload successful!';
        fileInput.value = ''; // Clear the input field
        setTimeout(() => { if(uploadStatus) uploadStatus.textContent = ''; }, 3000);

    } catch (error) {
        console.error('File upload process failed:', error);
        if(uploadStatus) uploadStatus.textContent = `Error: ${error.message}`;
    }
}

function listenForFiles(userId, planId) {
    const filesList = document.getElementById('files-list');
    if (!filesList) return;

    // Unsubscribe from any previous listener to prevent memory leaks
    if (fileUnsubscribe) {
        fileUnsubscribe();
    }

    const filesRef = collection(db, 'users', userId, 'plans', planId, 'files');
    const q = query(filesRef);

    fileUnsubscribe = onSnapshot(q, (snapshot) => {
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

