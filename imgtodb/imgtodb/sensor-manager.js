// Sensor Manager - Automated Image Capture System
class SensorManager {
    constructor() {
        this.isRunning = false;
        this.intervalId = null;
        this.displayUpdateInterval = null; // For real-time countdown updates
        this.captureInterval = 3600000; // Default: 1 hour (3600000ms)
        this.lastCaptureTime = null;
        this.nextCaptureTime = null;
        this.totalCaptures = 0;
        this.todayCaptures = 0;
        this.currentStream = null;
        this.init();
    }

    // Initialize the sensor manager
    init() {
        console.log('🤖 SensorManager initializing...');
        this.setupEventListeners();
        this.loadStoredData();
        this.updateDisplay();
        this.startDisplayUpdater(); // Start real-time display updates
        console.log('✅ SensorManager initialized');
    }

    // Start real-time display updater for countdown
    startDisplayUpdater() {
        // Update display every second for real-time countdown
        this.displayUpdateInterval = setInterval(() => {
            this.updateCountdown();
        }, 1000);
    }

    // Update only the countdown without full display refresh
    updateCountdown() {
        this.updateCountdownDisplay();
    }

    // Setup event listeners for UI controls
    setupEventListeners() {
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const captureNowBtn = document.getElementById('captureNowBtn');
        const testCameraBtn = document.getElementById('testCameraBtn');
        const intervalSelect = document.getElementById('intervalSelect');
        const closeCameraBtn = document.getElementById('closeSensorCamera');

        if (startBtn) {
            startBtn.addEventListener('click', () => this.startMonitoring());
        }

        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopMonitoring());
        }

        if (captureNowBtn) {
            captureNowBtn.addEventListener('click', () => this.captureNow());
        }

        if (testCameraBtn) {
            testCameraBtn.addEventListener('click', () => this.testCamera());
        }

        if (intervalSelect) {
            intervalSelect.addEventListener('change', (e) => {
                this.captureInterval = parseInt(e.target.value);
                this.saveSettings();
                this.updateNextCaptureTime();
            });
        }

        if (closeCameraBtn) {
            closeCameraBtn.addEventListener('click', () => this.closeCameraTest());
        }

        console.log('✅ Event listeners setup complete');
    }

    // Load stored data from localStorage
    loadStoredData() {
        try {
            const stored = localStorage.getItem('sensorManager');
            if (stored) {
                const data = JSON.parse(stored);
                this.totalCaptures = data.totalCaptures || 0;
                this.captureInterval = data.captureInterval || 3600000;
                this.lastCaptureTime = data.lastCaptureTime ? new Date(data.lastCaptureTime) : null;
                
                // Update interval selector
                const intervalSelect = document.getElementById('intervalSelect');
                if (intervalSelect) {
                    intervalSelect.value = this.captureInterval;
                }
            }

            // Calculate today's captures
            this.calculateTodayCaptures();
        } catch (error) {
            console.error('Error loading stored data:', error);
        }
    }

    // Save settings to localStorage
    saveSettings() {
        try {
            const data = {
                totalCaptures: this.totalCaptures,
                captureInterval: this.captureInterval,
                lastCaptureTime: this.lastCaptureTime ? this.lastCaptureTime.toISOString() : null
            };
            localStorage.setItem('sensorManager', JSON.stringify(data));
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }

    // Calculate today's captures from database
    async calculateTodayCaptures() {
        try {
            if (!window.supabaseClient) return;

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            // Convert to IST for proper comparison
            const todayIST = new Date(today.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
            const tomorrowIST = new Date(tomorrow.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));

            const { data, error } = await window.supabaseClient.client
                .from(window.SUPABASE_CONFIG.tableName)
                .select('id')
                .gte('uploaded_at', todayIST.toISOString())
                .lt('uploaded_at', tomorrowIST.toISOString())
                .contains('file_name', 'sensor_capture');

            if (error) {
                console.warn('Could not fetch today\'s captures:', error);
                return;
            }

            this.todayCaptures = data ? data.length : 0;
        } catch (error) {
            console.error('Error calculating today\'s captures:', error);
        }
    }

    // Start automated monitoring
    async startMonitoring() {
        if (this.isRunning) {
            this.showToast('Monitoring is already running', 'warning');
            return;
        }

        // Check location permission first
        if (!await this.checkLocationPermission()) {
            this.showToast('Location access is required for sensor monitoring. Please enable location permissions.', 'error');
            return;
        }

        this.isRunning = true;
        this.updateNextCaptureTime();
        
        // Start interval timer
        this.intervalId = setInterval(() => {
            this.performAutomatedCapture();
        }, this.captureInterval);

        this.updateDisplay();
        this.showToast(`Monitoring started. Next capture in ${this.formatDuration(this.captureInterval)}`, 'success');
        console.log(`🤖 Sensor monitoring started with ${this.captureInterval}ms interval`);
    }

    // Stop automated monitoring
    stopMonitoring() {
        if (!this.isRunning) {
            this.showToast('Monitoring is not running', 'warning');
            return;
        }

        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        // Clear display updater as well
        if (this.displayUpdateInterval) {
            clearInterval(this.displayUpdateInterval);
            this.displayUpdateInterval = null;
        }

        this.nextCaptureTime = null;
        this.updateDisplay();
        
        // Restart display updater for future use
        this.startDisplayUpdater();
        
        this.showToast('Monitoring stopped', 'info');
        console.log('🛑 Sensor monitoring stopped');
    }

    // Check location permission
    async checkLocationPermission() {
        try {
            if (!window.geolocationManager) {
                console.error('Geolocation manager not available');
                return false;
            }

            const location = await window.geolocationManager.getCurrentLocation();
            return !!location;
        } catch (error) {
            console.error('Location permission check failed:', error);
            return false;
        }
    }

    // Perform automated capture
    async performAutomatedCapture() {
        try {
            console.log('🤖 Performing automated capture...');
            await this.captureImageAutomatically();
            this.updateNextCaptureTime();
        } catch (error) {
            console.error('❌ Automated capture failed:', error);
            this.showToast('Automated capture failed: ' + error.message, 'error');
        }
    }

    // Capture image automatically (background)
    async captureImageAutomatically() {
        return new Promise(async (resolve, reject) => {
            try {
                // Get camera stream
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 1280, height: 720 }
                });

                // Create video element
                const video = document.createElement('video');
                video.srcObject = stream;
                video.autoplay = true;
                video.muted = true;

                video.onloadedmetadata = async () => {
                    try {
                        // Wait a moment for camera to stabilize
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        // Create canvas and capture frame
                        const canvas = document.createElement('canvas');
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(video, 0, 0);

                        // Convert to blob
                        canvas.toBlob(async (blob) => {
                            try {
                                // Stop stream
                                stream.getTracks().forEach(track => track.stop());

                                // Create file with sensor prefix
                                const timestamp = Date.now();
                                const fileName = `sensor_capture_${timestamp}.jpg`;
                                const file = new File([blob], fileName, { type: 'image/jpeg' });

                                // Upload to Supabase
                                const result = await window.supabaseClient.completeUpload(file, (progress, message) => {
                                    console.log(`📤 Upload progress: ${progress}% - ${message}`);
                                });

                                if (result) {
                                    this.totalCaptures++;
                                    this.todayCaptures++;
                                    this.lastCaptureTime = new Date();
                                    this.saveSettings();
                                    this.updateDisplay();
                                    await this.refreshCaptureHistory();
                                    
                                    console.log('✅ Automated capture completed successfully');
                                    this.showToast('Automated capture completed successfully', 'success');
                                    resolve(result);
                                } else {
                                    throw new Error('Upload failed');
                                }
                            } catch (error) {
                                stream.getTracks().forEach(track => track.stop());
                                reject(error);
                            }
                        }, 'image/jpeg', 0.8);
                    } catch (error) {
                        stream.getTracks().forEach(track => track.stop());
                        reject(error);
                    }
                };

                video.onerror = () => {
                    stream.getTracks().forEach(track => track.stop());
                    reject(new Error('Video loading failed'));
                };

            } catch (error) {
                reject(new Error('Camera access failed: ' + error.message));
            }
        });
    }

    // Manual capture now
    async captureNow() {
        if (!await this.checkLocationPermission()) {
            this.showToast('Location access is required for capturing. Please enable location permissions.', 'error');
            return;
        }

        try {
            this.showToast('Capturing image...', 'info');
            await this.captureImageAutomatically();
        } catch (error) {
            console.error('Manual capture failed:', error);
            this.showToast('Capture failed: ' + error.message, 'error');
        }
    }

    // Test camera functionality
    async testCamera() {
        try {
            const modal = document.getElementById('sensorCameraModal');
            const video = document.getElementById('sensorCameraVideo');

            if (!modal || !video) {
                throw new Error('Camera modal elements not found');
            }

            // Get camera stream
            this.currentStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720 }
            });

            video.srcObject = this.currentStream;
            modal.style.display = 'flex';
            this.showToast('Camera test started. Click "Close" when done.', 'info');

        } catch (error) {
            console.error('Camera test failed:', error);
            this.showToast('Camera test failed: ' + error.message, 'error');
        }
    }

    // Close camera test
    closeCameraTest() {
        const modal = document.getElementById('sensorCameraModal');
        const video = document.getElementById('sensorCameraVideo');

        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
            this.currentStream = null;
        }

        if (video) {
            video.srcObject = null;
        }

        if (modal) {
            modal.style.display = 'none';
        }

        this.showToast('Camera test closed', 'info');
    }

    // Update next capture time
    updateNextCaptureTime() {
        if (this.isRunning) {
            this.nextCaptureTime = new Date(Date.now() + this.captureInterval);
        } else {
            this.nextCaptureTime = null;
        }
        this.updateDisplay();
    }

    // Update display elements
    // Update next capture time display with real-time countdown
    updateCountdownDisplay() {
        const nextCaptureTime = document.getElementById('nextCaptureTime');
        if (nextCaptureTime) {
            if (this.nextCaptureTime && this.isRunning) {
                const timeUntil = this.nextCaptureTime - new Date();
                if (timeUntil > 0) {
                    nextCaptureTime.textContent = `Next capture in ${this.formatDuration(timeUntil)}`;
                } else {
                    nextCaptureTime.textContent = 'Capturing now...';
                }
            } else {
                nextCaptureTime.textContent = '';
            }
        }
    }

    updateDisplay() {
        // Status indicator
        const statusIndicator = document.getElementById('statusIndicator');
        const systemStatus = document.getElementById('systemStatus');
        const statusDetails = document.getElementById('statusDetails');

        if (statusIndicator && systemStatus && statusDetails) {
            if (this.isRunning) {
                statusIndicator.classList.add('active');
                systemStatus.textContent = 'Running';
                statusDetails.textContent = `Monitoring active - capturing every ${this.formatDuration(this.captureInterval)}`;
            } else {
                statusIndicator.classList.remove('active');
                systemStatus.textContent = 'Stopped';
                statusDetails.textContent = 'Click "Start Monitoring" to begin automated captures';
            }
        }

        // Buttons
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');

        if (startBtn && stopBtn) {
            startBtn.disabled = this.isRunning;
            stopBtn.disabled = !this.isRunning;
        }

        // Statistics
        const totalCapturesEl = document.getElementById('totalCaptures');
        const todayCapturesEl = document.getElementById('todayCaptures');
        const lastCaptureEl = document.getElementById('lastCapture');
        const nextCaptureEl = document.getElementById('nextCapture');

        if (totalCapturesEl) totalCapturesEl.textContent = this.totalCaptures;
        if (todayCapturesEl) todayCapturesEl.textContent = this.todayCaptures;
        
        if (lastCaptureEl) {
            lastCaptureEl.textContent = this.lastCaptureTime 
                ? this.lastCaptureTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                : 'Never';
        }

        if (nextCaptureEl) {
            nextCaptureEl.textContent = this.nextCaptureTime 
                ? this.nextCaptureTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                : 'Not scheduled';
        }

        // Next capture time in controls - use real-time countdown
        this.updateCountdownDisplay();
    }

    // Refresh capture history
    async refreshCaptureHistory() {
        try {
            const captureLog = document.getElementById('captureLog');
            if (!captureLog || !window.supabaseClient) return;

            // Fetch recent sensor captures
            const { data, error } = await window.supabaseClient.client
                .from(window.SUPABASE_CONFIG.tableName)
                .select('*')
                .ilike('file_name', '%sensor_capture%')
                .order('uploaded_at', { ascending: false })
                .limit(20);

            if (error) {
                console.error('Error fetching capture history:', error);
                return;
            }

            if (!data || data.length === 0) {
                captureLog.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #666;">
                        <i class="fas fa-camera fa-3x" style="opacity: 0.3; margin-bottom: 15px;"></i><br>
                        No automated captures yet. Start monitoring to begin.
                    </div>
                `;
                return;
            }

            // Display captures
            captureLog.innerHTML = data.map(capture => {
                const uploadTime = new Date(capture.uploaded_at);
                const timeStr = uploadTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
                const locationStr = capture.latitude && capture.longitude 
                    ? `📍 ${capture.latitude.toFixed(6)}, ${capture.longitude.toFixed(6)}`
                    : '📍 Location not available';

                return `
                    <div class="capture-entry">
                        <img src="${capture.file_url}" alt="Capture" class="capture-thumbnail" 
                             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22><rect width=%22100%%22 height=%22100%%22 fill=%22%23f0f0f0%22/><text x=%2250%%22 y=%2250%%22 font-family=%22Arial%22 font-size=%2212%22 fill=%22%23999%22 text-anchor=%22middle%22 dy=%22.3em%22>Image</text></svg>'">
                        <div class="capture-details">
                            <div class="capture-time">${timeStr}</div>
                            <div class="capture-location">${locationStr}</div>
                            <div style="font-size: 0.8rem; color: #999;">${capture.file_name}</div>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('Error refreshing capture history:', error);
        }
    }

    // Format duration for display
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    // Show toast notification
    showToast(message, type = 'info') {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
}

// Global function to refresh capture history
window.refreshCaptureHistory = async function() {
    if (window.sensorManager) {
        await window.sensorManager.refreshCaptureHistory();
        window.sensorManager.calculateTodayCaptures();
        window.sensorManager.updateDisplay();
    }
};

// Initialize sensor manager when DOM is ready
function initializeSensorManager() {
    if (window.sensorManager) {
        console.log('SensorManager already exists');
        return;
    }
    
    console.log('Creating new SensorManager instance');
    window.sensorManager = new SensorManager();
    
    // Load initial data
    setTimeout(() => {
        if (window.sensorManager) {
            window.sensorManager.refreshCaptureHistory();
        }
    }, 1000);
}

// Multiple initialization attempts
document.addEventListener('DOMContentLoaded', initializeSensorManager);
window.addEventListener('load', () => {
    setTimeout(initializeSensorManager, 100);
});

// Immediate initialization if DOM is already ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initializeSensorManager, 0);
}