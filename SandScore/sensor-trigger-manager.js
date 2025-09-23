// Sensor Trigger Manager - Database-Triggered Photo Capture System
class SensorTriggerManager {
    constructor() {
        this.isMonitoring = false;
        this.pollInterval = 10000; // Default: 10 seconds
        this.pollingTimer = null;
        this.lastProcessedId = null;
        this.totalTriggers = 0;
        this.todayTriggers = 0;
        this.successfulCaptures = 0;
        this.failedCaptures = 0;
        this.lastTriggerTime = null;
        this.lastCaptureTime = null;
        this.currentStream = null;
        this.init();
    }

    // Initialize the sensor trigger manager
    init() {
        console.log('🔗 SensorTriggerManager initializing...');
        this.setupEventListeners();
        this.loadStoredStats();
        this.updateDisplay();
        console.log('✅ SensorTriggerManager initialized');
    }

    // Setup event listeners for UI controls
    setupEventListeners() {
        const startBtn = document.getElementById('startMonitoringBtn');
        const stopBtn = document.getElementById('stopMonitoringBtn');
        const testBtn = document.getElementById('testTriggerBtn');
        const pollIntervalSelect = document.getElementById('pollInterval');
        const clearLogBtn = document.getElementById('clearLogBtn');

        if (startBtn) {
            startBtn.addEventListener('click', () => this.startMonitoring());
        }

        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopMonitoring());
        }

        if (testBtn) {
            testBtn.addEventListener('click', () => this.testTrigger());
        }

        if (pollIntervalSelect) {
            pollIntervalSelect.addEventListener('change', (e) => {
                this.pollInterval = parseInt(e.target.value);
                this.logActivity('System', `Polling interval changed to ${this.pollInterval / 1000} seconds`);
                if (this.isMonitoring) {
                    this.restartMonitoring();
                }
            });
        }

        if (clearLogBtn) {
            clearLogBtn.addEventListener('click', () => this.clearLog());
        }
    }

    // Load stored statistics
    loadStoredStats() {
        try {
            const stored = localStorage.getItem('sensorTriggerStats');
            if (stored) {
                const stats = JSON.parse(stored);
                this.totalTriggers = stats.totalTriggers || 0;
                this.successfulCaptures = stats.successfulCaptures || 0;
                this.failedCaptures = stats.failedCaptures || 0;
                this.lastProcessedId = stats.lastProcessedId || null;
            }
            this.calculateTodayTriggers();
        } catch (error) {
            console.error('Error loading stored stats:', error);
        }
    }

    // Save statistics to localStorage
    saveStats() {
        try {
            const stats = {
                totalTriggers: this.totalTriggers,
                successfulCaptures: this.successfulCaptures,
                failedCaptures: this.failedCaptures,
                lastProcessedId: this.lastProcessedId,
                lastSaved: new Date().toISOString()
            };
            localStorage.setItem('sensorTriggerStats', JSON.stringify(stats));
        } catch (error) {
            console.error('Error saving stats:', error);
        }
    }

    // Calculate today's triggers from database
    async calculateTodayTriggers() {
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
                .from('sensor_data')
                .select('id')
                .eq('button', 'yes')
                .gte('created_at', todayIST.toISOString())
                .lt('created_at', tomorrowIST.toISOString());

            if (error) {
                console.warn('Could not fetch today\'s triggers:', error);
                return;
            }

            this.todayTriggers = data ? data.length : 0;
        } catch (error) {
            console.error('Error calculating today\'s triggers:', error);
        }
    }

    // Start monitoring sensor_data table
    async startMonitoring() {
        if (this.isMonitoring) {
            this.showToast('Monitoring is already active', 'warning');
            return;
        }

        // Check location permission first
        if (!await this.checkLocationPermission()) {
            this.showToast('Location access is required for triggered captures. Please enable location permissions.', 'error');
            return;
        }

        this.isMonitoring = true;
        this.logActivity('System', 'Started monitoring sensor_data table');
        
        // Start polling timer
        this.pollingTimer = setInterval(() => {
            this.pollSensorData();
        }, this.pollInterval);

        this.updateDisplay();
        this.showToast(`Monitoring started. Checking every ${this.pollInterval / 1000} seconds`, 'success');
        console.log(`🔗 Sensor trigger monitoring started with ${this.pollInterval}ms interval`);
    }

    // Stop monitoring
    stopMonitoring() {
        if (!this.isMonitoring) {
            this.showToast('Monitoring is not active', 'warning');
            return;
        }

        this.isMonitoring = false;
        if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
            this.pollingTimer = null;
        }

        this.logActivity('System', 'Stopped monitoring sensor_data table');
        this.updateDisplay();
        this.showToast('Monitoring stopped', 'info');
        console.log('🛑 Sensor trigger monitoring stopped');
    }

    // Restart monitoring with new settings
    restartMonitoring() {
        if (this.isMonitoring) {
            this.stopMonitoring();
            setTimeout(() => this.startMonitoring(), 1000);
        }
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

    // Poll sensor_data table for new triggers
    async pollSensorData() {
        try {
            if (!window.supabaseClient) {
                console.error('Supabase client not available');
                return;
            }

            console.log('🔍 Polling sensor_data table for triggers...');

            // Build query for unprocessed 'yes' triggers
            const { data, error } = await window.supabaseClient.client
                .from('sensor_data')
                .select('*')
                .eq('button', 'yes')
                .eq('processed', false)
                .order('created_at', { ascending: true })
                .limit(5); // Limit to prevent overwhelming

            if (error) {
                console.error('Error polling sensor data:', error);
                this.logActivity('Error', `Database poll failed: ${error.message}`, 'error');
                return;
            }

            if (data && data.length > 0) {
                console.log(`📡 Found ${data.length} new trigger(s)`);
                this.logActivity('Trigger', `Found ${data.length} new trigger signal(s)`);
                
                // Process each trigger sequentially to prevent duplicates
                for (const trigger of data) {
                    // Double-check if this trigger is still unprocessed
                    const { data: checkData, error: checkError } = await window.supabaseClient.client
                        .from('sensor_data')
                        .select('processed')
                        .eq('id', trigger.id)
                        .single();
                    
                    if (checkError || !checkData || checkData.processed) {
                        console.log(`⏭️ Trigger ${trigger.id.substring(0, 8)}... already processed, skipping`);
                        continue;
                    }
                    
                    await this.processTrigger(trigger);
                }
            }

        } catch (error) {
            console.error('Error in pollSensorData:', error);
            this.logActivity('Error', `Polling error: ${error.message}`, 'error');
        }
    }

    // Process a single trigger
    async processTrigger(trigger) {
        try {
            console.log('🚨 Processing trigger:', trigger);
            this.logActivity('Trigger', `Processing trigger ID: ${trigger.id.substring(0, 8)}...`);

            // Mark as processed FIRST to prevent race conditions and duplicates
            const markResult = await this.markTriggerAsProcessed(trigger.id);
            if (!markResult) {
                console.log('⚠️ Failed to mark trigger as processed, skipping to prevent duplicates');
                return;
            }

            this.totalTriggers++;
            this.todayTriggers++;
            this.lastTriggerTime = new Date(trigger.created_at);

            // Store the processed trigger ID
            this.lastProcessedId = trigger.created_at;

            // Attempt to capture photo
            const success = await this.captureTriggeredPhoto(trigger);
            
            if (success) {
                this.successfulCaptures++;
                this.logActivity('Capture', `✅ Successfully captured photo for trigger ${trigger.id.substring(0, 8)}...`, 'capture');
            } else {
                this.failedCaptures++;
                this.logActivity('Error', `❌ Failed to capture photo for trigger ${trigger.id.substring(0, 8)}...`, 'error');
            }

            this.saveStats();
            this.updateDisplay();

        } catch (error) {
            console.error('Error processing trigger:', error);
            this.failedCaptures++;
            this.logActivity('Error', `Trigger processing failed: ${error.message}`, 'error');
            this.saveStats();
            this.updateDisplay();
        }
    }

    // Mark trigger as processed in database
    async markTriggerAsProcessed(triggerId) {
        try {
            console.log(`🔄 Marking trigger ${triggerId.substring(0, 8)}... as processed`);
            
            const { data, error } = await window.supabaseClient.client
                .from('sensor_data')
                .update({ processed: true })
                .eq('id', triggerId)
                .eq('processed', false) // Only update if still unprocessed
                .select();

            if (error) {
                console.error('Error marking trigger as processed:', error);
                return false;
            }

            if (!data || data.length === 0) {
                console.log('⚠️ Trigger was already processed by another instance');
                return false;
            }

            console.log(`✅ Successfully marked trigger as processed`);
            return true;
        } catch (error) {
            console.error('Error in markTriggerAsProcessed:', error);
            return false;
        }
    }

    // Capture photo in response to trigger
    async captureTriggeredPhoto(trigger) {
        try {
            console.log('📸 Initiating triggered photo capture...');

            // Get location data - mandatory for triggers
            let locationData = {};
            if (window.geolocationManager) {
                try {
                    console.log('📍 Getting location data...');
                    const location = await window.geolocationManager.getCurrentLocation();
                    if (location) {
                        locationData = {
                            latitude: location.latitude,
                            longitude: location.longitude,
                            location_accuracy: location.accuracy,
                            location_timestamp: location.timestamp
                        };
                        console.log('📍 Location data acquired:', {
                            lat: location.latitude.toFixed(6),
                            lng: location.longitude.toFixed(6),
                            accuracy: Math.round(location.accuracy) + 'm'
                        });
                    } else {
                        throw new Error('Location is required for triggered capture');
                    }
                } catch (error) {
                    console.error('❌ Could not get location for triggered capture:', error);
                    this.logActivity('Error', `Location failed: ${error.message}`, 'error');
                    return false;
                }
            } else {
                console.error('❌ Geolocation manager not available');
                this.logActivity('Error', 'Geolocation manager not available', 'error');
                return false;
            }

            // Access camera and capture photo
            console.log('📸 Starting camera capture...');
            const imageBlob = await this.accessCameraAndCapture();
            if (!imageBlob) {
                console.error('❌ Failed to capture image from camera');
                this.logActivity('Error', 'Camera capture failed - no image blob', 'error');
                return false;
            }

            console.log(`✅ Image captured - Size: ${imageBlob.size} bytes, Type: ${imageBlob.type}`);

            // Create file name with trigger info
            const timestamp = Date.now();
            const fileName = `trigger_capture_${timestamp}_${trigger.id.substring(0, 8)}.jpg`;

            // Create File object from blob
            const file = new File([imageBlob], fileName, { 
                type: 'image/jpeg',
                lastModified: timestamp 
            });

            console.log('📤 Uploading triggered capture:', {
                fileName,
                size: file.size,
                type: file.type,
                triggerId: trigger.id.substring(0, 8)
            });

            // Upload using existing Supabase upload system
            const uploadResult = await window.supabaseClient.uploadFile(file, fileName);
            if (!uploadResult) {
                console.error('❌ Failed to upload file to storage');
                this.logActivity('Error', 'File upload to storage failed', 'error');
                return false;
            }

            const publicUrl = window.supabaseClient.getPublicUrl(fileName);
            if (!publicUrl) {
                console.error('❌ Failed to get public URL');
                this.logActivity('Error', 'Failed to get public URL', 'error');
                return false;
            }

            // Prepare metadata with IST timestamp and trigger info
            const now = new Date();
            const istTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
            
            const uploadData = {
                file_name: fileName,
                file_size: file.size,
                file_type: file.type,
                file_url: publicUrl,
                uploaded_at: istTime.toISOString(),
                trigger_id: trigger.id,
                capture_type: 'triggered',
                sensor_id: trigger.sensor_id || 'unknown',
                ...locationData
            };

            console.log('💾 Saving metadata to database...');

            // Save to uploads table
            const metadata = await window.supabaseClient.saveUploadMetadata(uploadData);
            if (!metadata) {
                console.error('❌ Failed to save metadata');
                this.logActivity('Error', 'Failed to save metadata to database', 'error');
                return false;
            }

            this.lastCaptureTime = new Date();
            console.log('✅ Triggered capture completed successfully');
            this.logActivity('Success', `Photo uploaded successfully: ${fileName}`, 'info');
            return true;

        } catch (error) {
            console.error('❌ Error in captureTriggeredPhoto:', error);
            this.logActivity('Error', `Capture failed: ${error.message}`, 'error');
            return false;
        }
    }

    // Access camera and capture photo
    async accessCameraAndCapture() {
        return new Promise(async (resolve, reject) => {
            try {
                console.log('📹 Accessing camera for triggered capture...');

                // Get camera stream with more permissive constraints
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { 
                        width: { ideal: 1280, max: 1920 },
                        height: { ideal: 720, max: 1080 },
                        facingMode: { ideal: 'environment' } // Prefer back camera but allow front
                    },
                    audio: false
                });

                this.currentStream = stream;
                console.log('✅ Camera stream acquired');

                // Create video element for capture
                const video = document.createElement('video');
                video.srcObject = stream;
                video.autoplay = true;
                video.muted = true;
                video.playsInline = true;

                // Wait for video to be ready and capture
                video.onloadedmetadata = () => {
                    console.log('📹 Video metadata loaded, starting playback...');
                    video.play().then(() => {
                        console.log('📹 Video playing, will capture in 3 seconds...');
                        
                        // Capture after delay to ensure video is stable
                        setTimeout(() => {
                            try {
                                console.log('📸 Capturing photo...');
                                
                                // Create canvas for capture
                                const canvas = document.createElement('canvas');
                                const context = canvas.getContext('2d');

                                // Set canvas size to video size
                                canvas.width = video.videoWidth || 640;
                                canvas.height = video.videoHeight || 480;

                                console.log(`📸 Canvas size: ${canvas.width}x${canvas.height}`);

                                // Draw video frame to canvas
                                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                                // Convert to blob with high quality
                                canvas.toBlob((blob) => {
                                    // Clean up first
                                    this.stopCameraStream();
                                    
                                    if (blob && blob.size > 0) {
                                        console.log(`✅ Photo captured successfully - Size: ${blob.size} bytes`);
                                        resolve(blob);
                                    } else {
                                        console.error('❌ Failed to create image blob or blob is empty');
                                        reject(new Error('Failed to create image blob'));
                                    }
                                }, 'image/jpeg', 0.85); // Reduced quality for reliability

                            } catch (captureError) {
                                console.error('❌ Error during photo capture:', captureError);
                                this.stopCameraStream();
                                reject(captureError);
                            }
                        }, 3000); // 3 second delay for stabilization
                        
                    }).catch(playError => {
                        console.error('❌ Error playing video:', playError);
                        this.stopCameraStream();
                        reject(playError);
                    });
                };

                video.onerror = (videoError) => {
                    console.error('❌ Video error:', videoError);
                    this.stopCameraStream();
                    reject(videoError);
                };

                // Set a timeout as fallback
                setTimeout(() => {
                    this.stopCameraStream();
                    reject(new Error('Camera capture timeout after 10 seconds'));
                }, 10000);

            } catch (error) {
                console.error('❌ Error accessing camera:', error);
                this.stopCameraStream();
                reject(error);
            }
        });
    }

    // Stop camera stream
    stopCameraStream() {
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => {
                track.stop();
            });
            this.currentStream = null;
            console.log('📹 Camera stream stopped');
        }
    }

    // Test trigger functionality
    async testTrigger() {
        try {
            if (!window.supabaseClient) {
                this.showToast('Supabase client not available', 'error');
                return;
            }

            this.logActivity('Test', 'Inserting test trigger into sensor_data table');

            // Insert test trigger into sensor_data table
            const { data, error } = await window.supabaseClient.client
                .from('sensor_data')
                .insert([{
                    button: 'yes',
                    sensor_id: 'test_sensor',
                    metadata: { test: true, source: 'manual_test' }
                }])
                .select();

            if (error) {
                console.error('Error inserting test trigger:', error);
                this.showToast('Failed to insert test trigger', 'error');
                this.logActivity('Error', `Test trigger failed: ${error.message}`, 'error');
                return;
            }

            this.showToast('Test trigger inserted successfully! Will be processed on next poll.', 'success');
            this.logActivity('Test', `Test trigger inserted with ID: ${data[0].id.substring(0, 8)}...`);

        } catch (error) {
            console.error('Error in testTrigger:', error);
            this.showToast('Test trigger failed', 'error');
            this.logActivity('Error', `Test trigger error: ${error.message}`, 'error');
        }
    }

    // Update display elements
    updateDisplay() {
        // Status indicator
        const monitoringIndicator = document.getElementById('monitoringIndicator');
        const monitoringStatus = document.getElementById('monitoringStatus');
        const statusDetails = document.getElementById('statusDetails');

        if (monitoringIndicator && monitoringStatus && statusDetails) {
            if (this.isMonitoring) {
                monitoringIndicator.classList.add('active');
                monitoringStatus.textContent = 'Monitoring';
                statusDetails.textContent = `Actively checking for triggers every ${this.pollInterval / 1000} seconds`;
            } else {
                monitoringIndicator.classList.remove('active');
                monitoringStatus.textContent = 'Stopped';
                statusDetails.textContent = 'Click "Start Monitoring" to begin watching for sensor triggers';
            }
        }

        // Buttons
        const startBtn = document.getElementById('startMonitoringBtn');
        const stopBtn = document.getElementById('stopMonitoringBtn');

        if (startBtn && stopBtn) {
            startBtn.disabled = this.isMonitoring;
            stopBtn.disabled = !this.isMonitoring;
        }

        // Statistics
        const totalTriggersEl = document.getElementById('totalTriggers');
        const todayTriggersEl = document.getElementById('todayTriggers');
        const successfulCapturesEl = document.getElementById('successfulCaptures');
        const failedCapturesEl = document.getElementById('failedCaptures');

        if (totalTriggersEl) totalTriggersEl.textContent = this.totalTriggers;
        if (todayTriggersEl) todayTriggersEl.textContent = this.todayTriggers;
        if (successfulCapturesEl) successfulCapturesEl.textContent = this.successfulCaptures;
        if (failedCapturesEl) failedCapturesEl.textContent = this.failedCaptures;

        // Last trigger/capture times
        const lastTriggerEl = document.getElementById('lastTrigger');
        const lastTriggerTimeEl = document.getElementById('lastTriggerTime');
        const lastCaptureEl = document.getElementById('lastCapture');
        const lastCaptureTimeEl = document.getElementById('lastCaptureTime');

        if (lastTriggerEl && lastTriggerTimeEl) {
            if (this.lastTriggerTime) {
                lastTriggerEl.textContent = 'Trigger detected';
                lastTriggerTimeEl.textContent = this.lastTriggerTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
            } else {
                lastTriggerEl.textContent = 'No triggers detected';
                lastTriggerTimeEl.textContent = '';
            }
        }

        if (lastCaptureEl && lastCaptureTimeEl) {
            if (this.lastCaptureTime) {
                lastCaptureEl.textContent = 'Photo captured';
                lastCaptureTimeEl.textContent = this.lastCaptureTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
            } else {
                lastCaptureEl.textContent = 'No captures yet';
                lastCaptureTimeEl.textContent = '';
            }
        }
    }

    // Log activity to the UI log
    logActivity(type, message, level = 'info') {
        const logContent = document.getElementById('logContent');
        if (!logContent) return;

        const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${level}`;
        
        logEntry.innerHTML = `
            <span><strong>[${type}]</strong> ${message}</span>
            <small>${timestamp}</small>
        `;

        // Add to top of log
        logContent.insertBefore(logEntry, logContent.firstChild);

        // Keep only last 50 entries
        while (logContent.children.length > 50) {
            logContent.removeChild(logContent.lastChild);
        }

        console.log(`[${type}] ${message}`);
    }

    // Clear activity log
    clearLog() {
        const logContent = document.getElementById('logContent');
        if (logContent) {
            logContent.innerHTML = `
                <div class="log-entry">
                    <span>Log cleared</span>
                    <small>${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</small>
                </div>
            `;
        }
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

// Initialize sensor trigger manager when DOM is ready
function initializeSensorTriggerManager() {
    if (window.sensorTriggerManager) {
        console.log('SensorTriggerManager already exists');
        return;
    }
    
    console.log('🚀 Initializing sensor trigger manager...');
    try {
        window.sensorTriggerManager = new SensorTriggerManager();
        console.log('✅ Sensor trigger manager initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize sensor trigger manager:', error);
        setTimeout(initializeSensorTriggerManager, 1000);
    }
}

// Multiple initialization attempts
document.addEventListener('DOMContentLoaded', initializeSensorTriggerManager);
window.addEventListener('load', () => {
    setTimeout(initializeSensorTriggerManager, 100);
});

// Immediate initialization if DOM is already ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initializeSensorTriggerManager, 0);
}

// Export for global access
window.SensorTriggerManager = SensorTriggerManager;