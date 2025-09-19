// js/files.js

// Dependencies that will be passed from main.js
let db, appState, openModal;

// --- HTML Template for the 'My Files' view ---
const filesTemplate = `
<div class="space-y-8">
    <div class="page-header">
        <div>
            <h1 class="text-4xl font-black text-gray-900 font-poppins">My Files</h1>
            <p class="mt-1 text-lg text-gray-500">Manage documents for your plan, like P&L statements and KPIs.</p>
        </div>
        <div class="header-actions">
            <label for="file-upload-input" class="btn btn-primary cursor-pointer">
                <i class="bi bi-upload"></i>
                <span>Upload New File</span>
            </label>
            <input type="file" id="file-upload-input" class="hidden">
        </div>
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
            </div>
    </div>
</div>
`;

// This function will be called when the user clicks on the "My Files" nav link
export function renderFilesView(containerElement) {
    containerElement.innerHTML = filesTemplate;
    // We will add more logic here in the next steps (like displaying files)
}

// This function sets up the module with necessary dependencies from main.js
export function initializeFiles(database, state, modalOpener) {
    db = database;
    appState = state;
    openModal = modalOpener;
}
