// Geolocation Manager - Handles location tracking for uploads
class GeolocationManager {
    constructor() {
        this.currentLocation = null;
        this.isLocationEnabled = false;
        this.locationPermission = 'prompt'; // prompt, granted, denied
        this.init();
    }

    init() {
        console.log('🌍 Geolocation Manager initializing...');
        this.checkGeolocationSupport();
        this.requestLocationIfSupported();
    }

    checkGeolocationSupport() {
        if (!navigator.geolocation) {
            console.warn('❌ Geolocation is not supported by this browser');
            this.isLocationEnabled = false;
            return false;
        }
        
        console.log('✅ Geolocation is supported');
        return true;
    }

    async requestLocationIfSupported() {
        if (!this.checkGeolocationSupport()) {
            return null;
        }

        try {
            // Check current permission status
            if (navigator.permissions) {
                const permission = await navigator.permissions.query({ name: 'geolocation' });
                this.locationPermission = permission.state;
                console.log('📍 Geolocation permission status:', permission.state);
                
                // Listen for permission changes
                permission.onchange = () => {
                    this.locationPermission = permission.state;
                    console.log('📍 Geolocation permission changed to:', permission.state);
                };
            }

            // If permission is granted, get location immediately
            if (this.locationPermission === 'granted') {
                await this.getCurrentLocation();
            }

        } catch (error) {
            console.error('❌ Error checking geolocation permission:', error);
        }
    }

    async getCurrentLocation(options = {}) {
        if (!this.checkGeolocationSupport()) {
            return null;
        }

        const defaultOptions = {
            enableHighAccuracy: true,
            timeout: 10000, // 10 seconds
            maximumAge: 300000 // 5 minutes
        };

        const locationOptions = { ...defaultOptions, ...options };

        return new Promise((resolve, reject) => {
            console.log('📍 Requesting current location...');
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: new Date().toISOString()
                    };
                    
                    this.currentLocation = location;
                    this.isLocationEnabled = true;
                    
                    console.log('✅ Location obtained:', {
                        lat: location.latitude.toFixed(6),
                        lng: location.longitude.toFixed(6),
                        accuracy: Math.round(location.accuracy) + 'm'
                    });
                    
                    resolve(location);
                },
                (error) => {
                    this.handleLocationError(error);
                    reject(error);
                },
                locationOptions
            );
        });
    }

    handleLocationError(error) {
        let errorMessage = 'Unknown location error';
        
        switch (error.code) {
            case error.PERMISSION_DENIED:
                errorMessage = 'Location access denied by user';
                this.locationPermission = 'denied';
                this.isLocationEnabled = false;
                break;
            case error.POSITION_UNAVAILABLE:
                errorMessage = 'Location information unavailable';
                break;
            case error.TIMEOUT:
                errorMessage = 'Location request timed out';
                break;
        }
        
        console.warn('⚠️ Geolocation error:', errorMessage);
        this.isLocationEnabled = false;
        
        // Show user-friendly message
        if (error.code === error.PERMISSION_DENIED) {
            window.showToast('Location access denied. Uploads will continue without location data.', 'warning');
        }
    }

    async getLocationForUpload() {
        if (!this.checkGeolocationSupport()) {
            return null;
        }

        try {
            // Try to get fresh location if current location is too old (>5 minutes)
            const now = new Date();
            const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
            
            if (!this.currentLocation || new Date(this.currentLocation.timestamp) < fiveMinutesAgo) {
                console.log('📍 Getting fresh location for upload...');
                await this.getCurrentLocation();
            }
            
            return this.currentLocation;
        } catch (error) {
            console.warn('⚠️ Could not get location for upload:', error.message);
            return null;
        }
    }

    formatLocationForDisplay(location) {
        if (!location) {
            return 'Location not available';
        }

        return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
    }

    getLocationStatus() {
        return {
            isSupported: this.checkGeolocationSupport(),
            isEnabled: this.isLocationEnabled,
            permission: this.locationPermission,
            hasCurrentLocation: !!this.currentLocation,
            lastUpdate: this.currentLocation?.timestamp || null
        };
    }

    // Create a Google Maps link from coordinates
    getGoogleMapsLink(location) {
        if (!location) return null;
        return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
    }

    // Request location permission explicitly (for UI button)
    async requestLocationPermission() {
        try {
            const location = await this.getCurrentLocation();
            window.showToast('Location access granted', 'success');
            return location;
        } catch (error) {
            if (error.code === error.PERMISSION_DENIED) {
                window.showToast('Please enable location access in your browser settings', 'warning');
            } else {
                window.showToast('Could not get location: ' + error.message, 'error');
            }
            throw error;
        }
    }
}

// Initialize global geolocation manager
window.addEventListener('DOMContentLoaded', () => {
    window.geolocationManager = new GeolocationManager();
});