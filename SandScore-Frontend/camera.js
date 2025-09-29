// Camera functionality for taking photos
class CameraManager {
    constructor() {
        this.stream = null;
        this.video = null;
        this.canvas = null;
        this.capturedImageBlob = null;
        this.init();
    }

    init() {
        this.video = document.getElementById('cameraVideo');
        this.canvas = document.getElementById('cameraCanvas');
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Camera button to open modal
        const cameraBtn = document.getElementById('cameraBtn');
        if (cameraBtn) {
            cameraBtn.addEventListener('click', () => this.openCamera());
        }

        // Close camera modal
        const closeCameraBtn = document.getElementById('closeCameraBtn');
        if (closeCameraBtn) {
            closeCameraBtn.addEventListener('click', () => this.closeCamera());
        }

        // Capture photo
        const captureBtn = document.getElementById('captureBtn');
        if (captureBtn) {
            captureBtn.addEventListener('click', () => this.capturePhoto());
        }

        // Retake photo
        const retakeBtn = document.getElementById('retakeBtn');
        if (retakeBtn) {
            retakeBtn.addEventListener('click', () => this.retakePhoto());
        }

        // Use photo
        const usePhotoBtn = document.getElementById('usePhotoBtn');
        if (usePhotoBtn) {
            usePhotoBtn.addEventListener('click', () => this.usePhoto());
        }

        // Close modal on background click
        const cameraModal = document.getElementById('cameraModal');
        if (cameraModal) {
            cameraModal.addEventListener('click', (e) => {
                if (e.target === cameraModal) {
                    this.closeCamera();
                }
            });
        }

        // ESC key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeCamera();
            }
        });
    }

    async openCamera() {
        const modal = document.getElementById('cameraModal');
        const errorDiv = document.getElementById('cameraError');
        const errorText = document.getElementById('cameraErrorText');

        try {
            // Request camera access
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user' // Use front camera by default
                },
                audio: false
            });

            // Set video source
            this.video.srcObject = this.stream;
            
            // Show modal
            modal.style.display = 'flex';
            errorDiv.style.display = 'none';

            // Reset UI state
            this.resetCameraUI();

            window.showToast('Camera opened successfully', 'success');

        } catch (error) {
            console.error('Error accessing camera:', error);
            
            let errorMessage = 'Camera access failed';
            if (error.name === 'NotAllowedError') {
                errorMessage = 'Camera access denied. Please allow camera permissions.';
            } else if (error.name === 'NotFoundError') {
                errorMessage = 'No camera found on this device.';
            } else if (error.name === 'NotSupportedError') {
                errorMessage = 'Camera not supported in this browser.';
            }

            errorText.textContent = errorMessage;
            errorDiv.style.display = 'block';
            modal.style.display = 'flex';

            window.showToast(errorMessage, 'error');
        }
    }

    closeCamera() {
        // Stop camera stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        // Hide modal
        const modal = document.getElementById('cameraModal');
        modal.style.display = 'none';

        // Reset UI
        this.resetCameraUI();
    }

    resetCameraUI() {
        const video = document.getElementById('cameraVideo');
        const preview = document.getElementById('cameraPreview');
        const captureBtn = document.getElementById('captureBtn');
        const retakeBtn = document.getElementById('retakeBtn');
        const usePhotoBtn = document.getElementById('usePhotoBtn');

        video.style.display = 'block';
        preview.style.display = 'none';
        captureBtn.style.display = 'inline-flex';
        retakeBtn.style.display = 'none';
        usePhotoBtn.style.display = 'none';

        this.capturedImageBlob = null;
    }

    capturePhoto() {
        if (!this.video || !this.canvas) {
            window.showToast('Camera not properly initialized', 'error');
            return;
        }

        // Set canvas dimensions to match video
        const videoWidth = this.video.videoWidth;
        const videoHeight = this.video.videoHeight;
        
        this.canvas.width = videoWidth;
        this.canvas.height = videoHeight;

        // Draw video frame to canvas
        const ctx = this.canvas.getContext('2d');
        ctx.drawImage(this.video, 0, 0, videoWidth, videoHeight);

        // Convert canvas to blob
        this.canvas.toBlob((blob) => {
            if (!blob) {
                window.showToast('Failed to capture photo', 'error');
                return;
            }

            console.log('� [CAMERA] Photo captured:', {
                size: blob.size,
                type: blob.type
            });

            // Store the blob for later use
            this.capturedImageBlob = blob;
            
            // Show preview
            const preview = document.getElementById('cameraPreview');
            const capturedImage = document.getElementById('capturedImage');
            const video = document.getElementById('cameraVideo');
            
            capturedImage.src = URL.createObjectURL(blob);
            video.style.display = 'none';
            preview.style.display = 'block';

            // Update button visibility
            const captureBtn = document.getElementById('captureBtn');
            const retakeBtn = document.getElementById('retakeBtn');
            const usePhotoBtn = document.getElementById('usePhotoBtn');

            captureBtn.style.display = 'none';
            retakeBtn.style.display = 'inline-flex';
            usePhotoBtn.style.display = 'inline-flex';

            window.showToast('Photo captured! Review and use or retake.', 'success');

        }, 'image/jpeg', 0.9);
    }

    retakePhoto() {
        // Clean up the previous captured image
        const capturedImage = document.getElementById('capturedImage');
        if (capturedImage.src) {
            URL.revokeObjectURL(capturedImage.src);
        }

        // Reset UI to camera view
        this.resetCameraUI();
        
        window.showToast('Ready to take another photo', 'info');
    }

    usePhoto() {
        if (!this.capturedImageBlob) {
            window.showToast('No photo captured', 'error');
            return;
        }

        console.log('� [CAMERA] Using captured photo:', {
            size: this.capturedImageBlob.size,
            type: this.capturedImageBlob.type
        });

        if (this.capturedImageBlob.size === 0) {
            window.showToast('Captured image is empty', 'error');
            return;
        }

        // Create a File object from the blob
        const timestamp = Date.now();
        const filename = `camera-photo-${timestamp}.jpg`;
        
        const file = new File([this.capturedImageBlob], filename, {
            type: 'image/jpeg',
            lastModified: timestamp
        });

        console.log('📋 [CAMERA] Created file object:', {
            name: file.name,
            size: file.size,
            type: file.type
        });

        // Add the file to the upload manager
        if (window.uploadManager) {
            window.uploadManager.addFiles([file]);
            this.closeCamera();
            window.showToast('Photo added to upload queue', 'success');
        } else {
            console.error('❌ [CAMERA] Upload manager not available');
            window.showToast('Upload manager not available', 'error');
        }
    }

    // Switch between front and back camera (if available)
    async switchCamera() {
        if (!this.stream) return;

        try {
            // Stop current stream
            this.stream.getTracks().forEach(track => track.stop());

            // Determine current facing mode and switch
            const currentTrack = this.stream.getVideoTracks()[0];
            const settings = currentTrack.getSettings();
            const newFacingMode = settings.facingMode === 'user' ? 'environment' : 'user';

            // Request new stream with different facing mode
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: newFacingMode
                },
                audio: false
            });

            this.video.srcObject = this.stream;
            
            const cameraType = newFacingMode === 'user' ? 'front' : 'back';
            window.showToast(`Switched to ${cameraType} camera`, 'info');

        } catch (error) {
            console.error('Error switching camera:', error);
            window.showToast('Could not switch camera', 'warning');
        }
    }
}

// Initialize camera manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.cameraManager = new CameraManager();
});

// Export for use in other files
window.CameraManager = CameraManager;