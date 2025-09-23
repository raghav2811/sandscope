// Upload Functionality - Handles file selection, validation, and upload process
class UploadManager {
    constructor() {
        this.selectedFiles = [];
        this.currentUploads = [];
        this.isUploading = false;
        this.uploadAborted = false;
        this.init();
    }

    init() {
        console.log('UploadManager initializing...');
        this.setupEventListeners();
        console.log('UploadManager initialized');
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // File input change
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
            console.log('✅ File input event listener added');
        } else {
            console.warn('❌ File input not found during setup');
        }

        // Setup upload button with immediate binding
        this.setupUploadButton();
        
        // Setup camera button
        this.setupCameraButton();

        // Start upload button
        const startUpload = document.getElementById('startUpload');
        if (startUpload) {
            startUpload.addEventListener('click', () => this.startUpload());
            console.log('✅ Start upload button event listener added');
        }

        // Cancel upload button
        const cancelUpload = document.getElementById('cancelUpload');
        if (cancelUpload) {
            cancelUpload.addEventListener('click', () => this.cancelUpload());
            console.log('✅ Cancel upload button event listener added');
        }

        // Cancel active upload button
        const cancelActiveUpload = document.getElementById('cancelActiveUpload');
        if (cancelActiveUpload) {
            cancelActiveUpload.addEventListener('click', () => this.cancelActiveUpload());
            console.log('✅ Cancel active upload button event listener added');
        }

        // Drag and drop events
        this.setupDragAndDrop();
        console.log('✅ Event listeners setup complete');
    }

    setupUploadButton() {
        const uploadBtn = document.getElementById('uploadBtn');
        if (!uploadBtn) {
            console.warn('❌ Upload button not found');
            return;
        }

        // Clear any existing event listeners
        uploadBtn.replaceWith(uploadBtn.cloneNode(true));
        const newUploadBtn = document.getElementById('uploadBtn');

        // Add click event listener
        newUploadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🖱️ Upload button clicked');
            this.triggerFileSelect();
        });

        // Add touch event for mobile
        newUploadBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            console.log('👆 Upload button touched');
            this.triggerFileSelect();
        });

        // Add keyboard support
        newUploadBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                console.log('⌨️ Upload button activated via keyboard');
                this.triggerFileSelect();
            }
        });

        console.log('✅ Upload button event listeners added');
    }

    setupCameraButton() {
        const cameraBtn = document.getElementById('cameraBtn');
        if (!cameraBtn) {
            console.warn('❌ Camera button not found');
            return;
        }

        // Clear any existing event listeners
        cameraBtn.replaceWith(cameraBtn.cloneNode(true));
        const newCameraBtn = document.getElementById('cameraBtn');

        // Add click event listener
        newCameraBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('📷 Camera button clicked');
            if (window.cameraManager) {
                window.cameraManager.openCamera();
            } else {
                console.warn('Camera manager not available');
                window.showToast('Camera feature not available', 'warning');
            }
        });

        console.log('✅ Camera button event listeners added');
    }

    setupDragAndDrop() {
        const uploadArea = document.getElementById('uploadArea');
        if (!uploadArea) return;

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, this.preventDefaults, false);
            document.body.addEventListener(eventName, this.preventDefaults, false);
        });

        // Highlight drop area when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => this.highlight(uploadArea), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => this.unhighlight(uploadArea), false);
        });

        // Handle dropped files
        uploadArea.addEventListener('drop', (e) => this.handleDrop(e), false);
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    highlight(element) {
        element.classList.add('drag-over');
    }

    unhighlight(element) {
        element.classList.remove('drag-over');
    }

    triggerFileSelect() {
        console.log('Upload button clicked');
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            console.log('File input found, triggering click');
            fileInput.click();
        } else {
            console.error('File input not found!');
            window.showToast('File input not found', 'error');
        }
    }

    handleFileSelect(event) {
        console.log('File select event triggered', event);
        const files = Array.from(event.target.files);
        console.log('Files selected:', files.length);
        this.addFiles(files);
    }

    handleDrop(event) {
        const dt = event.dataTransfer;
        const files = Array.from(dt.files);
        this.addFiles(files);
    }

    addFiles(files) {
        console.log('🔄 [UPLOAD] Adding files to upload manager:', files.length);
        
        // Log details of each file being added
        files.forEach((file, index) => {
            console.log(`📁 [UPLOAD] File ${index + 1}:`, {
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified,
                constructor: file.constructor.name
            });
        });

        // Validate and filter files
        const validFiles = [];
        const errors = [];

        files.forEach(file => {
            const validation = this.validateFile(file);
            if (validation.valid) {
                validFiles.push(file);
                console.log(`✅ [UPLOAD] File validated successfully: ${file.name}`);
            } else {
                errors.push(`${file.name}: ${validation.error}`);
                console.log(`❌ [UPLOAD] File validation failed: ${file.name} - ${validation.error}`);
            }
        });

        // Show validation errors
        if (errors.length > 0) {
            window.showToast(`Some files were rejected:\n${errors.join('\n')}`, 'warning');
        }

        // Check total file limit
        const totalFiles = this.selectedFiles.length + validFiles.length;
        if (totalFiles > window.APP_CONFIG.maxFiles) {
            const allowedCount = window.APP_CONFIG.maxFiles - this.selectedFiles.length;
            validFiles.splice(allowedCount);
            window.showToast(`Maximum ${window.APP_CONFIG.maxFiles} files allowed. Only first ${allowedCount} files added.`, 'warning');
        }

        // Add valid files
        this.selectedFiles.push(...validFiles);
        console.log(`📋 [UPLOAD] Total files in queue: ${this.selectedFiles.length}`);
        this.updateUI();
        this.displaySelectedFiles();
    }

    validateFile(file) {
        console.log('🔍 [VALIDATION] Validating file:', {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            constructor: file.constructor.name
        });

        // Check if it's an image
        if (!file.type.startsWith('image/')) {
            console.log('❌ [VALIDATION] File type check failed - not an image:', file.type);
            return { valid: false, error: 'Only image files are allowed' };
        }

        // Check file type
        if (!window.APP_CONFIG.allowedTypes.includes(file.type)) {
            console.log('❌ [VALIDATION] File type not in allowed list:', file.type, 'Allowed:', window.APP_CONFIG.allowedTypes);
            return { valid: false, error: 'File type not supported' };
        }

        // Check file size
        if (file.size > window.APP_CONFIG.maxFileSize) {
            const maxSizeMB = window.APP_CONFIG.maxFileSize / (1024 * 1024);
            console.log('❌ [VALIDATION] File size too large:', file.size, 'Max:', window.APP_CONFIG.maxFileSize);
            return { valid: false, error: `File size exceeds ${maxSizeMB}MB limit` };
        }

        // Check if file is empty
        if (file.size === 0) {
            console.log('❌ [VALIDATION] File is empty');
            return { valid: false, error: 'File is empty' };
        }

        // Check for duplicates
        const isDuplicate = this.selectedFiles.some(existingFile => 
            existingFile.name === file.name && existingFile.size === file.size
        );
        if (isDuplicate) {
            console.log('❌ [VALIDATION] Duplicate file detected');
            return { valid: false, error: 'Duplicate file' };
        }

        console.log('✅ [VALIDATION] File validation passed for:', file.name);
        return { valid: true };
    }

    displaySelectedFiles() {
        const container = document.getElementById('selectedFiles');
        if (!container) return;

        container.innerHTML = '';

        this.selectedFiles.forEach((file, index) => {
            const fileElement = this.createFilePreview(file, index);
            container.appendChild(fileElement);
        });
    }

    createFilePreview(file, index) {
        const div = document.createElement('div');
        div.className = 'file-preview fade-in';
        
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.alt = file.name;
        img.onload = () => URL.revokeObjectURL(img.src); // Clean up object URL

        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';

        const fileName = document.createElement('div');
        fileName.className = 'file-name';
        fileName.textContent = this.truncateFileName(file.name, 20);
        fileName.title = file.name;

        const fileSize = document.createElement('div');
        fileSize.className = 'file-size';
        fileSize.textContent = this.formatFileSize(file.size);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-file';
        removeBtn.innerHTML = '×';
        removeBtn.title = 'Remove file';
        removeBtn.addEventListener('click', () => this.removeFile(index));

        fileInfo.appendChild(fileName);
        fileInfo.appendChild(fileSize);

        div.appendChild(img);
        div.appendChild(fileInfo);
        div.appendChild(removeBtn);

        return div;
    }

    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.displaySelectedFiles();
        this.updateUI();
    }

    updateUI() {
        const uploadControls = document.getElementById('uploadControls');
        const hasFiles = this.selectedFiles.length > 0;

        if (uploadControls) {
            uploadControls.style.display = hasFiles ? 'flex' : 'none';
        }

        // Update file count in upload button
        const uploadBtn = document.getElementById('uploadBtn');
        if (uploadBtn && hasFiles) {
            const originalText = uploadBtn.querySelector('i').nextSibling;
            if (originalText) {
                originalText.textContent = ` Choose More Files (${this.selectedFiles.length} selected)`;
            }
        } else if (uploadBtn) {
            const originalText = uploadBtn.querySelector('i').nextSibling;
            if (originalText) {
                originalText.textContent = ' Choose Files';
            }
        }
    }

    cancelUpload() {
        this.selectedFiles = [];
        this.displaySelectedFiles();
        this.updateUI();
        
        // Reset file input
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.value = '';
        }

        window.showToast('File selection cleared', 'info');
    }

    async startUpload() {
        if (this.selectedFiles.length === 0) {
            window.showToast('No files selected', 'warning');
            return;
        }

        if (this.isUploading) {
            window.showToast('Upload already in progress', 'warning');
            return;
        }

        // Check location permission before starting upload - MANDATORY
        if (!await this.checkLocationPermission()) {
            window.showToast('Location access is required for uploading. Please enable location permissions and try again.', 'error');
            return;
        }

        this.isUploading = true;
        this.uploadAborted = false;
        this.showUploadProgress();

        try {
            await this.uploadFiles();
        } catch (error) {
            console.error('Upload failed:', error);
            window.showToast('Upload failed: ' + error.message, 'error');
        } finally {
            this.isUploading = false;
            this.hideUploadProgress();
        }
    }

    async uploadFiles() {
        const totalFiles = this.selectedFiles.length;
        let uploadedCount = 0;
        const successful = [];
        const failed = [];

        for (let i = 0; i < totalFiles; i++) {
            if (this.uploadAborted) {
                break;
            }

            const file = this.selectedFiles[i];
            
            try {
                this.updateProgress(
                    (i / totalFiles) * 100,
                    `Uploading ${file.name} (${i + 1}/${totalFiles})...`
                );

                const result = await window.supabaseClient.completeUpload(
                    file,
                    (progress, status) => {
                        const overallProgress = ((i + progress / 100) / totalFiles) * 100;
                        this.updateProgress(overallProgress, status);
                    }
                );

                successful.push({ file: file.name, result });
                uploadedCount++;

            } catch (error) {
                console.error(`Failed to upload ${file.name}:`, error);
                failed.push({ file: file.name, error: error.message });
            }
        }

        // Show results
        if (this.uploadAborted) {
            window.showToast('Upload cancelled', 'warning');
        } else if (failed.length === 0) {
            window.showToast(`Successfully uploaded ${uploadedCount} files`, 'success');
            this.cancelUpload(); // Clear selections
            // Refresh history
            if (window.historyManager) {
                window.historyManager.loadHistory();
            }
        } else if (successful.length > 0) {
            window.showToast(`${uploadedCount} files uploaded, ${failed.length} failed`, 'warning');
        } else {
            window.showToast('All uploads failed', 'error');
        }
    }

    cancelActiveUpload() {
        this.uploadAborted = true;
        window.showToast('Cancelling upload...', 'info');
    }

    showUploadProgress() {
        const progressDiv = document.getElementById('uploadProgress');
        const controlsDiv = document.getElementById('uploadControls');
        
        if (progressDiv) progressDiv.style.display = 'block';
        if (controlsDiv) controlsDiv.style.display = 'none';
    }

    hideUploadProgress() {
        const progressDiv = document.getElementById('uploadProgress');
        const controlsDiv = document.getElementById('uploadControls');
        
        if (progressDiv) progressDiv.style.display = 'none';
        if (controlsDiv && this.selectedFiles.length > 0) {
            controlsDiv.style.display = 'flex';
        }
    }

    updateProgress(percentage, text) {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');

        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }

        if (progressText) {
            progressText.textContent = `${text} ${Math.round(percentage)}%`;
        }
    }

    // Utility functions
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    truncateFileName(name, maxLength) {
        if (name.length <= maxLength) return name;
        const extension = name.split('.').pop();
        const nameWithoutExt = name.substring(0, name.lastIndexOf('.'));
        const truncated = nameWithoutExt.substring(0, maxLength - extension.length - 4) + '...';
        return truncated + '.' + extension;
    }

    // Check location permission before upload
    async checkLocationPermission() {
        try {
            if (!window.geolocationManager) {
                console.error('Geolocation manager not available');
                return false;
            }

            // Try to get current location to check permission
            const location = await window.geolocationManager.getCurrentLocation();
            if (!location) {
                console.warn('Location permission not granted');
                return false;
            }

            console.log('✅ Location permission verified');
            return true;
        } catch (error) {
            console.error('Location permission check failed:', error);
            return false;
        }
    }
}

// Export the class globally
window.UploadManager = UploadManager;

// Robust initialization system
function initializeUploadManager() {
    if (window.uploadManager) {
        console.log('✅ Upload manager already exists');
        return;
    }

    console.log('🚀 Initializing upload manager...');
    try {
        window.uploadManager = new UploadManager();
        console.log('✅ Upload manager initialized successfully');
        
        // Expose global methods for easy access
        window.triggerFileSelect = () => {
            if (window.uploadManager) {
                window.uploadManager.triggerFileSelect();
            }
        };
        
        window.addFilesToUpload = (files) => {
            if (window.uploadManager) {
                window.uploadManager.addFiles(files);
            }
        };
        
    } catch (error) {
        console.error('❌ Failed to initialize upload manager:', error);
        setTimeout(initializeUploadManager, 1000);
    }
}

// Multiple initialization attempts
document.addEventListener('DOMContentLoaded', initializeUploadManager);
window.addEventListener('load', () => {
    setTimeout(initializeUploadManager, 100);
});

// Immediate initialization if DOM is already ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initializeUploadManager, 0);
}