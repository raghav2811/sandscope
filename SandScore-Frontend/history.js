// Upload History Management - Handles displaying and managing upload history
class HistoryManager {
    constructor() {
        this.uploads = [];
        this.loading = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadHistory();
    }

    setupEventListeners() {
        // Refresh button
        const refreshBtn = document.getElementById('refreshHistory');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadHistory());
        }

        // Auto-refresh on window focus (optional)
        window.addEventListener('focus', () => {
            // Refresh history when user returns to tab
            if (document.hidden === false) {
                this.loadHistory();
            }
        });
    }

    async loadHistory() {
        if (this.loading) return;

        this.loading = true;
        this.showLoading();

        try {
            // Test connection first
            await window.supabaseClient.testConnection();
            
            // Fetch upload history
            this.uploads = await window.supabaseClient.getUploadHistory();
            this.displayHistory();
            
        } catch (error) {
            console.error('Failed to load history:', error);
            this.showError(error.message);
        } finally {
            this.loading = false;
            this.hideLoading();
        }
    }

    displayHistory() {
        const historyGrid = document.getElementById('historyGrid');
        const emptyState = document.getElementById('emptyState');

        if (!historyGrid || !emptyState) return;

        // Clear existing content
        historyGrid.innerHTML = '';

        if (this.uploads.length === 0) {
            emptyState.style.display = 'block';
            historyGrid.style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            historyGrid.style.display = 'grid';

            this.uploads.forEach(upload => {
                const historyItem = this.createHistoryItem(upload);
                historyGrid.appendChild(historyItem);
            });
        }
    }

    createHistoryItem(upload) {
        const div = document.createElement('div');
        div.className = 'history-item fade-in';
        div.setAttribute('data-upload-id', upload.id);

        // Create image element
        const img = document.createElement('img');
        img.src = upload.file_url;
        img.alt = upload.file_name;
        img.loading = 'lazy'; // Lazy load images for better performance
        
        // Handle image load errors
        img.onerror = () => {
            img.src = this.createPlaceholderImage();
            img.alt = 'Image not available';
        };

        // Create info section
        const info = document.createElement('div');
        info.className = 'history-item-info';

        // File name
        const name = document.createElement('div');
        name.className = 'history-item-name';
        name.textContent = upload.file_name;
        name.title = upload.file_name; // Full name on hover

        // File details
        const details = document.createElement('div');
        details.className = 'history-item-details';

        const size = document.createElement('span');
        size.textContent = this.formatFileSize(upload.file_size);

        const type = document.createElement('span');
        type.textContent = upload.file_type.split('/')[1].toUpperCase();

        details.appendChild(size);
        details.appendChild(type);

        // Location info if available
        if (upload.latitude && upload.longitude) {
            const location = document.createElement('span');
            location.className = 'location-info-item';
            location.innerHTML = '<i class="fas fa-map-marker-alt"></i>';
            location.title = `Location: ${upload.latitude.toFixed(6)}, ${upload.longitude.toFixed(6)}`;
            details.appendChild(location);
        }

        // Upload date
        const date = document.createElement('div');
        date.className = 'history-item-date';
        date.textContent = this.formatDate(upload.uploaded_at);
        
        // Show full IST time on hover
        const uploadDate = new Date(upload.uploaded_at);
        date.title = uploadDate.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        }) + ' IST';

        // Actions container
        const actions = document.createElement('div');
        actions.className = 'history-item-actions';

        // View/Download button
        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn btn-small btn-primary';
        viewBtn.innerHTML = '<i class="fas fa-eye"></i>';
        viewBtn.title = 'View Image';
        viewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.viewImage(upload);
        });

        // Copy URL button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn btn-small btn-secondary';
        copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        copyBtn.title = 'Copy URL';
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.copyUrl(upload.file_url);
        });

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-small btn-danger';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.title = 'Delete';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteUpload(upload);
        });

        actions.appendChild(viewBtn);
        actions.appendChild(copyBtn);
        actions.appendChild(deleteBtn);

        // Assemble the item
        info.appendChild(name);
        info.appendChild(details);
        info.appendChild(date);
        info.appendChild(actions);

        div.appendChild(img);
        div.appendChild(info);

        // Click to view image
        div.addEventListener('click', () => this.viewImage(upload));

        return div;
    }

    viewImage(upload) {
        // Create modal to view image
        const modal = this.createImageModal(upload);
        document.body.appendChild(modal);

        // Close modal on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal(modal);
            }
        });

        // Prevent modal from closing when clicking on content
        content.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Close on escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal(modal);
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    createImageModal(upload) {
        const modal = document.createElement('div');
        modal.className = 'image-modal';

        const content = document.createElement('div');
        content.className = 'modal-content';

        const img = document.createElement('img');
        img.src = upload.file_url;
        img.alt = upload.file_name;

        const info = document.createElement('div');
        info.className = 'modal-info';

        const fileName = document.createElement('h3');
        fileName.textContent = upload.file_name;

        const fileDetails = document.createElement('p');
        fileDetails.textContent = `${this.formatFileSize(upload.file_size)} • ${upload.file_type} • ${this.formatDate(upload.uploaded_at)}`;

        // Add location information if available
        if (upload.latitude && upload.longitude && window.locationUIManager) {
            const locationDisplay = window.locationUIManager.createLocationDisplay(upload);
            if (locationDisplay) {
                locationDisplay.style.cssText = 'margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 8px;';
                info.appendChild(fileName);
                info.appendChild(fileDetails);
                info.appendChild(locationDisplay);
            } else {
                info.appendChild(fileName);
                info.appendChild(fileDetails);
            }
        } else {
            info.appendChild(fileName);
            info.appendChild(fileDetails);
        }

        const actions = document.createElement('div');
        actions.className = 'modal-actions';

        const downloadBtn = document.createElement('a');
        downloadBtn.href = upload.file_url;
        downloadBtn.download = upload.file_name;
        downloadBtn.className = 'btn btn-primary';
        downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn btn-secondary';
        closeBtn.innerHTML = '<i class="fas fa-times"></i> Close';
        closeBtn.addEventListener('click', () => this.closeModal(modal));

        actions.appendChild(downloadBtn);
        actions.appendChild(closeBtn);

        info.appendChild(actions);

        content.appendChild(img);
        content.appendChild(info);
        modal.appendChild(content);

        return modal;
    }

    closeModal(modal) {
        modal.style.opacity = '0';
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 300);
    }

    async copyUrl(url) {
        try {
            await navigator.clipboard.writeText(url);
            window.showToast('URL copied to clipboard', 'success');
        } catch (error) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = url;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            window.showToast('URL copied to clipboard', 'success');
        }
    }

    async deleteUpload(upload) {
        const confirmed = confirm(`Are you sure you want to delete "${upload.file_name}"?`);
        if (!confirmed) return;

        try {
            window.showToast('Deleting...', 'info');

            // Delete from storage and database
            const fileName = upload.file_url.split('/').pop();
            await window.supabaseClient.deleteFile(fileName);
            await window.supabaseClient.deleteUploadRecord(upload.id);

            // Remove from local array
            this.uploads = this.uploads.filter(u => u.id !== upload.id);
            
            // Update display
            this.displayHistory();
            
            window.showToast('File deleted successfully', 'success');
        } catch (error) {
            console.error('Delete failed:', error);
            window.showToast('Failed to delete file: ' + error.message, 'error');
        }
    }

    showLoading() {
        const loading = document.getElementById('historyLoading');
        const grid = document.getElementById('historyGrid');
        const empty = document.getElementById('emptyState');

        if (loading) loading.style.display = 'block';
        if (grid) grid.style.display = 'none';
        if (empty) empty.style.display = 'none';
    }

    hideLoading() {
        const loading = document.getElementById('historyLoading');
        if (loading) loading.style.display = 'none';
    }

    showError(message) {
        const historyContent = document.getElementById('historyContent');
        if (!historyContent) return;

        historyContent.innerHTML = `
            <div class="error-state" style="text-align: center; padding: 40px; color: #dc3545;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 15px; display: block;"></i>
                <h3>Failed to load history</h3>
                <p style="margin: 10px 0; color: #666;">${message}</p>
                <button class="btn btn-primary" onclick="window.historyManager.loadHistory()">
                    <i class="fas fa-retry"></i> Try Again
                </button>
            </div>
        `;
    }

    createPlaceholderImage() {
        // Create a simple placeholder image using canvas
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 150;
        const ctx = canvas.getContext('2d');
        
        // Gray background
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, 200, 150);
        
        // Icon
        ctx.fillStyle = '#ccc';
        ctx.font = '40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🖼️', 100, 85);
        
        return canvas.toDataURL();
    }

    // Utility functions
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        
        // Convert both dates to IST for proper comparison
        const istDate = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
        const istNow = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
        
        const diffTime = Math.abs(istNow - istDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            return 'Today';
        } else if (diffDays === 2) {
            return 'Yesterday';
        } else if (diffDays <= 7) {
            return `${diffDays - 1} days ago`;
        } else {
            // Return date in Indian format
            return istDate.toLocaleDateString('en-IN', {
                timeZone: 'Asia/Kolkata',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
    }
}

// Initialize history manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.historyManager = new HistoryManager();
});