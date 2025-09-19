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
            <div id="files-loading-state" class="flex items-center justify-center p-8 text-gray-500">
                <div class="loading-spinner !w-8 !h-8 mr-4"></div>
                <span>Loading files...</span>
            </div>
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
    if (!container) return;

    // Always clear the container first to remove the loading state
    container.innerHTML = '';

    if (files.length === 0) {
        container.innerHTML = `<p id="no-files-message" class="text-gray-500">You haven't uploaded any files for this plan yet.</p>`;
        return;
    }

    files.forEach(file => {
        const fileElement = document.createElement('div');
        fileElement.className = 'flex items-center justify-between p-3 rounded-lg hover:bg-gray-50';
        fileElement.innerHTML = `
            <div class="flex items-center gap-4">
                <i class="bi bi-file-earmark-text text-2xl text-gray-400"></i>
                <div>
                    <a href="#" class="font-semibold text-gray-800 hover:underline view-file-link" data-file='${JSON.stringify(file)}'>${file.name}</a>
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
        
        const viewLink = e.target.closest('.view-file-link');
        if (viewLink) {
            e.preventDefault();
            const fileData = JSON.parse(viewLink.dataset.file);
            openFileViewerModal(fileData);
        }
    });
}
function openFileViewerModal(file) {
    const modal = document.getElementById('file-view-modal');
    const title = document.getElementById('file-modal-title');
    const content = document.getElementById('file-modal-content');
    const downloadBtn = document.getElementById('file-modal-download-btn');
    const deleteBtn = document.getElementById('file-modal-delete-btn');
    
    // Zoom & Pan Elements
    const zoomInBtn = document.getElementById('file-modal-zoom-in-btn');
    const zoomOutBtn = document.getElementById('file-modal-zoom-out-btn');
    const zoomResetBtn = document.getElementById('file-modal-zoom-reset-btn');

    title.textContent = file.name;
    content.innerHTML = ''; // Clear previous content
    content.className = 'modal-content'; // Reset classes

    let viewerElement;

    if (file.type.startsWith('image/')) {
        viewerElement = document.createElement('img');
        viewerElement.src = file.url;
        viewerElement.alt = file.name;
        viewerElement.className = 'zoomable-content';
        content.appendChild(viewerElement);
    } else if (file.type === 'application/pdf') {
        viewerElement = document.createElement('iframe');
        viewerElement.src = file.url;
        viewerElement.width = "100%";
        viewerElement.height = "100%";
        viewerElement.frameborder = "0";
        viewerElement.className = 'zoomable-content'; // PDF can also be zoomed
        content.appendChild(viewerElement);
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        content.innerHTML = `<div class="flex items-center justify-center h-full"><div class="loading-spinner"></div><p class="ml-4 text-gray-600">Rendering document...</p></div>`;
        
        fetch(file.url)
            .then(response => response.arrayBuffer())
            .then(buffer => {
                const docxContainer = document.createElement('div');
                docxContainer.className = 'docx-preview-container'; // For styling
                
                docx.renderAsync(buffer, docxContainer)
                    .then(() => {
                        content.innerHTML = ''; // Clear loading indicator
                        content.appendChild(docxContainer);
                        viewerElement = docxContainer;
                        setupZoomAndPan(); // Setup zoom after rendering
                    })
                    .catch(error => {
                        console.error('Error rendering .docx file:', error);
                        content.innerHTML = `<div class="file-placeholder"><i class="bi bi-exclamation-circle"></i><p class="mt-4 font-semibold">Could not render this document.</p></div>`;
                    });
            })
            .catch(error => {
                 console.error('Error fetching .docx file:', error);
                 content.innerHTML = `<div class="file-placeholder"><i class="bi bi-exclamation-circle"></i><p class="mt-4 font-semibold">Could not load this document.</p></div>`;
            });
    } else {
        content.innerHTML = `
            <div class="file-placeholder">
                <i class="bi bi-file-earmark-arrow-down"></i>
                <p class="mt-4 font-semibold">Preview not available</p>
                <p class="text-sm">Download the file to view its contents.</p>
            </div>
        `;
    }

    function setupZoomAndPan() {
        if (!viewerElement) return;

        let zoomLevel = 1;
        let isPanning = false;
        let startPos = { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 };
        
        const applyZoom = () => {
            viewerElement.style.transform = `scale(${zoomLevel})`;
            content.style.cursor = zoomLevel > 1 ? 'grab' : 'default';
        };

        zoomInBtn.onclick = () => { zoomLevel = Math.min(3, zoomLevel + 0.2); applyZoom(); };
        zoomOutBtn.onclick = () => { zoomLevel = Math.max(0.5, zoomLevel - 0.2); applyZoom(); };
        zoomResetBtn.onclick = () => { zoomLevel = 1; applyZoom(); };

        content.onmousedown = (e) => {
            if (zoomLevel <= 1) return;
            isPanning = true;
            content.style.cursor = 'grabbing';
            startPos = {
                x: e.clientX,
                y: e.clientY,
                scrollLeft: content.scrollLeft,
                scrollTop: content.scrollTop
            };
        };

        content.onmousemove = (e) => {
            if (!isPanning) return;
            e.preventDefault();
            const dx = e.clientX - startPos.x;
            const dy = e.clientY - startPos.y;
            content.scrollTop = startPos.scrollTop - dy;
            content.scrollLeft = startPos.scrollLeft - dx;
        };
        
        const stopPanning = () => {
            isPanning = false;
            content.style.cursor = zoomLevel > 1 ? 'grab' : 'default';
        };

        content.onmouseup = stopPanning;
        content.onmouseleave = stopPanning;

        applyZoom(); // Set initial state
    }

    if (viewerElement) {
        setupZoomAndPan();
    }
    

    downloadBtn.onclick = () => { window.open(file.url, '_blank'); };
    deleteBtn.onclick = () => {
        modal.classList.add('hidden');
        openModal('confirmDeleteFile', { planId: file.id, fileName: file.name });
    };

    modal.classList.remove('hidden');
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