// Main Application - Ties together all functionality and handles global features
class ImageUploadApp {
    constructor() {
        this.init();
    }

    init() {
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.onDOMReady());
        } else {
            this.onDOMReady();
        }
    }

    onDOMReady() {
        console.log('Image Upload App initializing...');
        
        // Initialize toast system
        this.initToastSystem();
        
        // Check Supabase configuration
        this.checkConfiguration();
        
        // Set up global error handling
        this.setupErrorHandling();
        
        // Initialize all components
        this.initializeComponents();
        
        console.log('Image Upload App ready!');
    }

    checkConfiguration() {
        if (!window.SUPABASE_CONFIG) {
            this.showToast('Configuration not found. Please check config.js', 'error');
            return;
        }

        if (window.SUPABASE_CONFIG.url === 'YOUR_SUPABASE_URL' || 
            window.SUPABASE_CONFIG.anonKey === 'YOUR_SUPABASE_ANON_KEY') {
            this.showToast('Please update your Supabase credentials in config.js', 'warning');
        }
    }

    initializeComponents() {
        // Components are initialized by their respective files
        // This method can be used for any additional setup
        
        // Test Supabase connection after a short delay
        setTimeout(() => this.testConnection(), 1000);
    }

    async testConnection() {
        try {
            const isConnected = await window.supabaseClient.testConnection();
            if (isConnected) {
                console.log('Supabase connection successful');
            }
        } catch (error) {
            console.error('Supabase connection failed:', error);
            this.showToast('Database connection failed. Please check your setup.', 'error');
        }
    }

    setupErrorHandling() {
        // Global error handler for unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.showToast('An unexpected error occurred', 'error');
        });

        // Global error handler for JavaScript errors
        window.addEventListener('error', (event) => {
            console.error('JavaScript error:', event.error);
            this.showToast('An unexpected error occurred', 'error');
        });
    }

    initToastSystem() {
        // Make showToast globally available
        window.showToast = (message, type = 'info', duration = 5000) => {
            this.showToast(message, type, duration);
        };
    }

    showToast(message, type = 'info', duration = 5000) {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            console.log(`${type.toUpperCase()}: ${message}`);
            return;
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = this.getToastIcon(type);
        const toastContent = `
            <i class="${icon}"></i>
            <div class="toast-message">
                <div class="toast-title">${this.getToastTitle(type)}</div>
                <div class="toast-text">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        toast.innerHTML = toastContent;
        
        // Add CSS for toast if not already present
        this.addToastStyles();
        
        toastContainer.appendChild(toast);

        // Auto remove toast after duration
        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (toast.parentElement) {
                        toast.remove();
                    }
                }, 300);
            }
        }, duration);

        // Click to remove
        toast.addEventListener('click', () => {
            toast.remove();
        });
    }

    getToastIcon(type) {
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        return icons[type] || icons.info;
    }

    getToastTitle(type) {
        const titles = {
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            info: 'Info'
        };
        return titles[type] || titles.info;
    }

    addToastStyles() {
        // Check if styles are already added
        if (document.getElementById('toast-styles')) return;

        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            .toast {
                cursor: pointer;
            }
            
            .toast-message {
                flex: 1;
            }
            
            .toast-title {
                font-weight: 600;
                margin-bottom: 2px;
            }
            
            .toast-text {
                font-size: 0.9rem;
                opacity: 0.9;
            }
            
            .toast-close {
                background: none;
                border: none;
                color: #666;
                cursor: pointer;
                padding: 5px;
                margin-left: 10px;
                border-radius: 3px;
                transition: background-color 0.2s;
            }
            
            .toast-close:hover {
                background-color: rgba(0,0,0,0.1);
            }
        `;
        
        document.head.appendChild(style);
    }

    // Utility methods
    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            const text = overlay.querySelector('p');
            if (text) text.textContent = message;
            overlay.style.display = 'flex';
        }
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    // Format bytes to human readable format
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Debounce function
    debounce(func, wait, immediate) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(this, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(this, args);
        };
    }

    // Check if user is online
    isOnline() {
        return navigator.onLine;
    }

    // Handle online/offline status
    setupNetworkStatusHandling() {
        window.addEventListener('online', () => {
            this.showToast('Connection restored', 'success');
        });

        window.addEventListener('offline', () => {
            this.showToast('Connection lost. Some features may not work.', 'warning');
        });
    }
}

// Global app utilities
window.app = {
    showLoading: (message) => window.imageUploadApp.showLoading(message),
    hideLoading: () => window.imageUploadApp.hideLoading(),
    formatBytes: (bytes, decimals) => window.imageUploadApp.formatBytes(bytes, decimals),
    isOnline: () => window.imageUploadApp.isOnline()
};

// Initialize the application
window.imageUploadApp = new ImageUploadApp();

// Setup service worker for offline capabilities (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Uncomment to enable service worker
        // navigator.serviceWorker.register('/sw.js')
        //     .then(registration => console.log('SW registered:', registration))
        //     .catch(error => console.log('SW registration failed:', error));
    });
}