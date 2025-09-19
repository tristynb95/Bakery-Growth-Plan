// js/files.js

// Dependencies that will be passed from main.js
let db, appState, openModal, storage;

// --- HTML Template for the 'My Files' view ---
const filesTemplate = `
<div class="space-y-8">
    <div class="flex justify-end">
        <label for="file-upload-input" class="btn btn-primary cursor-pointer">
            <i class="bi bi-upload"></i>
            <span>Upload New File</span>
        </label>
        <input type="file" id="file-upload-input" class="hidden">
    </div>

    <div id="file-upload-progress-container" class="hidden bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div class="flex items-center">
            <div id="upload-spinner" class="loading-spinner !w-8 !h-8 !border-4 mr-4"></div>
            <div>
                <p class="font-semibold text-blue-800">Uploading: <span id="upload-filename"></span></p>
                <div class="progress-bar-container mt-2 bg-blue-100">
                    <div id="upload-progress-bar" class="progress-bar-fill !bg-blue-600" style="width: 0%;"></div>
                </div>
            </div>
        </div>
    </div>

    <div class="content-card p-6">
        <h3 class="profile-card-title">Uploaded Documents</h3>
        <div id="file-list-container" class="mt-4">
            <p id="no-files-message" class="text-gray-500">You haven't uploaded any files for this plan yet.</p>
            {/* File items will be dynamically inserted here */}
        </div>
    </div>
</div>
`;

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function renderFileList(files = []) {
    const container = document.getElementById('file-list-container');
    const noFilesMessage = document.getElementById('no-files-message');

    if (files.length === 0) {
        noFilesMessage.classList.remove('hidden');
        container.innerHTML = ''; // Clear any existing files
        container.appendChild(noFilesMessage);
        return;
    }

    noFilesMessage.classList.add('hidden');
    container.innerHTML = ''; // Clear the container before rendering

    files.forEach(file => {
        const fileElement = document.createElement('div');
        fileElement.className = 'flex items-center justify-between p-3 rounded-lg hover:bg-gray-50';
        fileElement.innerHTML = `
            <div class="flex items-center gap-4">
                <i class="bi bi-file-earmark-text text-2xl text-gray-400"></i>
                <div>
                    <a href="${file.url}" target="_blank" rel="noopener noreferrer" class="font-semibold text-gray-800 hover:underline">${file.name}</a>
                    <p class="text-sm text-gray-500">${formatFileSize(file.size)}</p>
                </div>
            </div>
            <button class="btn btn-secondary !p-2 delete-file-btn" data-file-id="${file.id}" title="Delete File">
                <i class="bi bi-trash3"></i>
            </button>
        `;
        container.appendChild(fileElement);
    });
}

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const progressContainer = document.getElementById('file-upload-progress-container');
    const filenameSpan = document.getElementById('upload-filename');
    const progressBar = document.getElementById('upload-progress-bar');
    
    filenameSpan.textContent = file.name;
    progressBar.style.width = '0%';
    progressContainer.classList.remove('hidden');

    const filePath = `user_files/${appState.currentUser.uid}/${appState.currentPlanId}/${Date.now()}-${file.name}`;
    const fileRef = storage.ref(filePath);
    const uploadTask = fileRef.put(file);

    uploadTask.on('state_changed',
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            progressBar.style.width = progress + '%';
        },
        (error) => {
            console.error("Upload failed:", error);
            openModal('warning', 'Upload Failed', 'There was an error uploading your file. Please try again.');
            progressContainer.classList.add('hidden');
        },
        async () => {
            const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
            const fileData = {
                name: file.name,
                url: downloadURL,
                path: filePath,
                size: file.size,
                type: file.type,
                uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const planRef = db.collection('users').doc(appState.currentUser.uid).collection('plans').doc(appState.currentPlanId);
            await planRef.collection('files').add(fileData);
            
            progressContainer.classList.add('hidden');
            // No need to manually refresh, the listener will do it.
        }
    );
}

async function deleteFile(fileId) {
    const fileRef = db.collection('users').doc(appState.currentUser.uid)
                       .collection('plans').doc(appState.currentPlanId)
                       .collection('files').doc(fileId);
    
    try {
        const fileDoc = await fileRef.get();
        if (!fileDoc.exists) {
            throw new Error("File document not found in database.");
        }

        const filePath = fileDoc.data().path;
        const storageRef = storage.ref(filePath);

        // Delete from Firebase Storage
        await storageRef.delete();

        // Delete from Firestore
        await fileRef.delete();

    } catch (error) {
        console.error("Error deleting file:", error);
        openModal('warning', 'Deletion Failed', 'Could not delete the file. It may have already been removed.');
    }
}


export function renderFilesView(containerElement) {
    containerElement.innerHTML = filesTemplate;

    const planFilesRef = db.collection('users').doc(appState.currentUser.uid)
                           .collection('plans').doc(appState.currentPlanId)
                           .collection('files')
                           .orderBy('uploadedAt', 'desc');
    
    // Listen for real-time updates to the files
    appState.filesUnsubscribe = planFilesRef.onSnapshot(snapshot => {
        const files = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderFileList(files);
    });

    // Add event listener for the file input
    const fileUploadInput = document.getElementById('file-upload-input');
    fileUploadInput.addEventListener('change', handleFileUpload);

    // Add event listener for delete buttons (using event delegation)
    const fileListContainer = document.getElementById('file-list-container');
    fileListContainer.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-file-btn');
        if (deleteBtn) {
            const fileId = deleteBtn.dataset.fileId;
            if (confirm('Are you sure you want to permanently delete this file?')) {
                deleteFile(fileId);
            }
        }
    });
}

export function initializeFiles(database, state, modalOpener) {
    db = database;
    appState = state;
    openModal = modalOpener;
    storage = firebase.storage(); // Initialize Firebase Storage
}
