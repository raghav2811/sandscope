// Location UI Manager - Handles location status display and user interactions
class LocationUIManager {
    constructor() {
        this.locationText = null;
        this.locationIcon = null;
        this.enableLocationBtn = null;
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initElements());
        } else {
            this.initElements();
        }
    }

    initElements() {
        this.locationText = document.getElementById('locationText');
        this.locationIcon = document.getElementById('locationIcon');
        this.enableLocationBtn = document.getElementById('enableLocationBtn');

        if (!this.locationText || !this.locationIcon || !this.enableLocationBtn) {
            console.warn('⚠️ Location UI elements not found');
            return;
        }

        // Set up event listener for enable location button
        this.enableLocationBtn.addEventListener('click', () => this.handleEnableLocationClick());

        // Monitor geolocation manager status
        this.startStatusMonitoring();
        
        console.log('📍 Location UI Manager initialized');
    }

    startStatusMonitoring() {
        // Initial status check
        this.updateLocationStatus();

        // Check status periodically
        setInterval(() => {
            this.updateLocationStatus();
        }, 5000); // Check every 5 seconds
    }

    updateLocationStatus() {
        if (!window.geolocationManager) {
            this.showLocationStatus('Geolocation not available', 'disabled', false);
            return;
        }

        const status = window.geolocationManager.getLocationStatus();

        if (!status.isSupported) {
            this.showLocationStatus('Location not supported', 'disabled', false);
        } else if (status.permission === 'denied') {
            this.showLocationStatus('Location access denied', 'disabled', true);
        } else if (status.permission === 'granted' && status.hasCurrentLocation) {
            const location = window.geolocationManager.currentLocation;
            const locationStr = window.geolocationManager.formatLocationForDisplay(location);
            this.showLocationStatus(`Location: ${locationStr}`, 'enabled', false);
        } else if (status.permission === 'granted' && !status.hasCurrentLocation) {
            this.showLocationStatus('Getting location...', 'loading', false);
        } else {
            this.showLocationStatus('Location available', 'disabled', true);
        }
    }

    showLocationStatus(text, iconState, showButton) {
        if (!this.locationText || !this.locationIcon || !this.enableLocationBtn) {
            return;
        }

        // Update text
        this.locationText.textContent = text;

        // Update icon
        this.locationIcon.className = 'fas fa-map-marker-alt';
        this.locationIcon.classList.remove('enabled', 'disabled', 'loading');
        this.locationIcon.classList.add(iconState);

        // Show/hide enable button
        this.enableLocationBtn.style.display = showButton ? 'inline-flex' : 'none';
    }

    async handleEnableLocationClick() {
        if (!window.geolocationManager) {
            window.showToast('Geolocation manager not available', 'error');
            return;
        }

        try {
            this.showLocationStatus('Requesting location...', 'loading', false);
            await window.geolocationManager.requestLocationPermission();
            this.updateLocationStatus();
        } catch (error) {
            console.error('❌ Failed to enable location:', error);
            this.updateLocationStatus();
        }
    }

    // Method to show location in upload history modal or other contexts
    createLocationDisplay(upload) {
        if (!upload.latitude || !upload.longitude) {
            return null;
        }

        const locationDiv = document.createElement('div');
        locationDiv.className = 'location-display';

        const coords = `${upload.latitude.toFixed(6)}, ${upload.longitude.toFixed(6)}`;
        const accuracy = upload.location_accuracy ? ` (±${Math.round(upload.location_accuracy)}m)` : '';
        
        locationDiv.innerHTML = `
            <div class="location-info">
                <i class="fas fa-map-marker-alt"></i>
                <span class="location-coords">${coords}${accuracy}</span>
                <a href="${this.getGoogleMapsLink(upload)}" target="_blank" class="location-link">
                    <i class="fas fa-external-link-alt"></i> View on Map
                </a>
            </div>
        `;

        return locationDiv;
    }

    getGoogleMapsLink(upload) {
        if (!upload.latitude || !upload.longitude) return '#';
        return `https://www.google.com/maps?q=${upload.latitude},${upload.longitude}`;
    }
}

// Initialize when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    window.locationUIManager = new LocationUIManager();
});