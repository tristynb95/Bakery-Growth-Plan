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

    if (!container || !noFilesMessage) return;

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
            <button class="btn btn-secondary !p-2 delete-file-btn" data-file-id="${file.id}" data-file-name="${file.name}" title="Delete File">
                <i class="bi bi-trash3"></i>
            </button>
        `;
        container.appendChild(fileElement);
    });
}

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

     // --- START: FILE VALIDATION ---
    const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/png',
        'image/jpeg'
    ];
    const maxSizeInMB = 10;
    const maxSizeBytes = maxSizeInMB * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
        openModal('warning', { 
            title: 'Invalid File Type', 
            message: `Please upload a supported file type: PDF, DOCX, XLSX, PNG, or JPG.` 
        });
        e.target.value = ''; // Clear the file input
        return;
    }

    if (file.size > maxSizeBytes) {
        openModal('warning', { 
            title: 'File Too Large', 
            message: `Please select a file smaller than ${maxSizeInMB}MB.` 
        });
        e.target.value = ''; // Clear the file input
        return;
    }
    // --- END: FILE VALIDATION ---

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
            openModal('warning', { title: 'Upload Failed', message: 'There was an error uploading your file. Please try again.' });
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

        await storageRef.delete();
        await fileRef.delete();

        // FIX: Manually refresh the file list after deletion.
        // The onSnapshot listener in renderFilesView should handle this automatically,
        // but it is not being triggered upon deletion for an unknown reason.
        // This workaround ensures the UI updates immediately by manually re-fetching
        // and re-rendering the file list. While this is less efficient than a
        // functioning real-time listener, it is a reliable fix for the user-facing bug.
        const planFilesRef = db.collection('users').doc(appState.currentUser.uid)
                           .collection('plans').doc(appState.currentPlanId)
                           .collection('files')
                           .orderBy('uploadedAt', 'desc');

        const snapshot = await planFilesRef.get();
        const files = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderFileList(files);

    } catch (error) {
        console.error("Error deleting file:", error);
        openModal('warning', { title: 'Deletion Failed', message: 'Could not delete the file. It may have already been removed.' });
    }
}


export function renderFilesView(containerElement) {
    containerElement.innerHTML = filesTemplate;

    const planFilesRef = db.collection('users').doc(appState.currentUser.uid)
                           .collection('plans').doc(appState.currentPlanId)
                           .collection('files')
                           .orderBy('uploadedAt', 'desc');
    
    if (appState.filesUnsubscribe) appState.filesUnsubscribe();
    
    appState.filesUnsubscribe = planFilesRef.onSnapshot(snapshot => {
        const files = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderFileList(files);
    }, error => {
        console.error("Error listening to file changes:", error);
    });

    document.getElementById('file-upload-input').addEventListener('change', handleFileUpload);

    document.getElementById('file-list-container').addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-file-btn');
        if (deleteBtn) {
            const fileId = deleteBtn.dataset.fileId;
            const fileName = deleteBtn.dataset.fileName;
            openModal('confirmDeleteFile', { planId: fileId, fileName: fileName });
        }
    });
}

export function initializeFiles(database, state, modalOpener) {
    db = database;
    appState = state;
    openModal = modalOpener;
    storage = firebase.storage();
    
    document.addEventListener('file-deletion-confirmed', (e) => {
        const { fileId } = e.detail;
        if (fileId && appState.currentView === 'files') {
            deleteFile(fileId);
        }
    });
}
