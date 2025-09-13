// js/files.js

// Dependencies to be passed from main.js
let db, storage, appState;

// --- DOM Element References ---
let dropZone, fileGrid, fileInput, placeholder;
let fileUnsubscribe = null; // To listen for real-time file updates

/**
 * Creates an HTML element for a single file item.
 * @param {object} fileData - The metadata for the file from Firestore.
 * @returns {HTMLElement} The file item element.
 */
function createFileElement(fileData) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.dataset.fileId = fileData.id;

    const fileTypeIcons = {
        'pdf': 'bi-file-earmark-pdf-fill',
        'doc': 'bi-file-earmark-word-fill',
        'docx': 'bi-file-earmark-word-fill',
        'xls': 'bi-file-earmark-excel-fill',
        'xlsx': 'bi-file-earmark-excel-fill',
        'default': 'bi-file-earmark-text-fill'
    };

    const extension = fileData.name.split('.').pop().toLowerCase();
    const iconClass = fileTypeIcons[extension] || fileTypeIcons['default'];

    const uploadedDate = fileData.uploadedAt?.toDate ? fileData.uploadedAt.toDate().toLocaleDateString('en-GB') : 'Just now';

    fileItem.innerHTML = `
        <div class="file-thumbnail">
            <i class="bi ${iconClass}"></i>
        </div>
        <div class="file-info">
            <p class="file-name">${fileData.name}</p>
            <p class="file-metadata">${uploadedDate}</p>
        </div>
    `;
    return fileItem;
}


/**
 * Renders the files from Firestore metadata into the grid.
 */
function renderFiles() {
    if (fileUnsubscribe) {
        fileUnsubscribe(); // Stop listening to previous plan's files
    }

    const filesRef = db.collection('users').doc(appState.currentUser.uid)
                       .collection('plans').doc(appState.currentPlanId)
                       .collection('files')
                       .orderBy('uploadedAt', 'desc');

    fileUnsubscribe = filesRef.onSnapshot(snapshot => {
        if (snapshot.empty) {
            placeholder.classList.remove('hidden');
            fileGrid.innerHTML = ''; // Clear old files
            fileGrid.appendChild(placeholder);
        } else {
            placeholder.classList.add('hidden');
            fileGrid.innerHTML = ''; // Clear grid before re-rendering
            snapshot.forEach(doc => {
                const fileEl = createFileElement({ id: doc.id, ...doc.data() });
                fileGrid.appendChild(fileEl);
            });
        }
    }, error => {
        console.error("Error fetching files:", error);
        placeholder.classList.remove('hidden');
        placeholder.querySelector('p').textContent = 'Could not load files.';
    });
}


/**
 * Handles the file upload process by sending files to a Netlify function.
 * @param {FileList} files - The files to upload.
 */
function uploadFiles(files) {
    if (!files || files.length === 0) return;
    if (!appState.currentUser || !appState.currentPlanId) {
        console.error("User or plan not identified. Cannot upload file.");
        return;
    }

    placeholder.classList.add('hidden');

    Array.from(files).forEach(async (file) => {
        // --- Create a temporary placeholder while uploading ---
        const tempFileItem = document.createElement('div');
        tempFileItem.className = 'file-item';
        tempFileItem.innerHTML = `
            <div class="file-thumbnail">
                <div class="loading-spinner"></div>
            </div>
            <div class="file-info">
                <p class="file-name">${file.name}</p>
                <p class="file-metadata">Uploading...</p>
            </div>
        `;
        fileGrid.prepend(tempFileItem);
        // --------------------------------------------------

        const formData = new FormData();
        formData.append('file', file);
        formData.append('planId', appState.currentPlanId);
        formData.append('userId', appState.currentUser.uid);

        try {
            const response = await fetch('/.netlify/functions/upload-file', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Upload failed with status: ${response.status}`);
            }

            // The real-time listener will automatically add the new file to the UI.
            // We just need to remove the placeholder.
            tempFileItem.remove();
        } catch (error) {
            console.error("Upload failed:", error);
            tempFileItem.remove(); // Remove placeholder on failure
            alert(`Error uploading ${file.name}. Please try again.`);
        }
    });
}


/**
 * Initializes all event listeners for the "My Files" view.
 */
function initializeFileViewListeners() {
    dropZone = document.getElementById('file-drop-zone');
    fileGrid = document.getElementById('file-grid-container');
    fileInput = document.getElementById('file-upload-input');
    placeholder = document.querySelector('.file-item-placeholder'); // Find the original placeholder

    if (!dropZone) return; // Exit if the view isn't active

    // Drag and Drop Listeners
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('is-active');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('is-active');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('is-active');
        uploadFiles(e.dataTransfer.files);
    });

    // Traditional File Input Listener
    fileInput.addEventListener('change', (e) => {
        uploadFiles(e.target.files);
        e.target.value = ''; // Reset input to allow uploading the same file again
    });
}

/**
 * Main entry point for the files module. Called when the user switches to the "My Files" view.
 */
export function showFilesView() {
    initializeFileViewListeners();
    renderFiles(); // Fetch and display files in real-time
}

/**
 * Initializes the module with necessary dependencies from main.js.
 */
export function initializeFiles(database, storageService, state) {
    db = database;
    storage = storageService;
    appState = state;
}
