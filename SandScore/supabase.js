// Supabase Client Setup and Database Operations
class SupabaseClient {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.init();
    }

    // Initialize Supabase client
    init() {
        try {
            if (!window.SUPABASE_CONFIG.url || !window.SUPABASE_CONFIG.anonKey) {
                throw new Error('Supabase configuration is missing. Please check config.js');
            }

            // Credentials are configured - proceeding with initialization

            this.client = window.supabase.createClient(
                window.SUPABASE_CONFIG.url,
                window.SUPABASE_CONFIG.anonKey,
                {
                    auth: {
                        persistSession: false
                    }
                    // Removed global headers that were forcing application/json for all requests
                    // This was causing file uploads to be treated as JSON instead of binary files
                }
            );
            
            this.isConnected = true;
            console.log('Supabase client initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Supabase client:', error);
            this.showToast('Configuration Error: ' + error.message, 'error');
        }
    }

    // Check if client is properly configured
    checkConnection() {
        if (!this.isConnected || !this.client) {
            this.showToast('Supabase is not properly configured', 'error');
            return false;
        }
        return true;
    }

    // Upload file to Supabase Storage
    async uploadFile(file, fileName) {
        if (!this.checkConnection()) return null;

        try {
            console.log('🚀 [SUPABASE] Starting upload:', {
                fileName: fileName,
                originalName: file.name,
                size: file.size,
                type: file.type,
                constructor: file.constructor.name
            });

            // Validate file before upload
            if (!file || file.size === 0) {
                throw new Error('File is empty or invalid');
            }

            if (!file.type || !file.type.startsWith('image/')) {
                console.error('❌ [SUPABASE] Invalid file type:', file.type);
                throw new Error('File is not a valid image');
            }

            console.log('📤 [SUPABASE] Uploading to bucket:', window.SUPABASE_CONFIG.bucketName);
            console.log('📤 [SUPABASE] Upload options:', {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type
            });

            // Upload with proper content type
            const { data, error } = await this.client.storage
                .from(window.SUPABASE_CONFIG.bucketName)
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: file.type
                });

            if (error) {
                console.error('❌ [SUPABASE] Upload error:', error);
                throw error;
            }

            console.log('✅ [SUPABASE] Upload successful:', {
                path: data.path,
                id: data.id,
                fullPath: data.fullPath
            });
            
            return data;
        } catch (error) {
            console.error('❌ [SUPABASE] Error uploading file:', error);
            throw new Error(`Upload failed: ${error.message}`);
        }
    }

    // Get public URL for uploaded file
    getPublicUrl(fileName) {
        if (!this.checkConnection()) return null;

        try {
            const { data } = this.client.storage
                .from(window.SUPABASE_CONFIG.bucketName)
                .getPublicUrl(fileName);

            return data.publicUrl;
        } catch (error) {
            console.error('Error getting public URL:', error);
            return null;
        }
    }

    // Save upload metadata to database
    async saveUploadMetadata(uploadData) {
        if (!this.checkConnection()) return null;

        try {
            const { data, error } = await this.client
                .from(window.SUPABASE_CONFIG.tableName)
                .insert([uploadData])
                .select();

            if (error) {
                throw error;
            }

            return data[0];
        } catch (error) {
            console.error('Error saving metadata:', error);
            throw new Error(`Failed to save metadata: ${error.message}`);
        }
    }

    // Get upload history from database
    async getUploadHistory(limit = 50) {
        if (!this.checkConnection()) return [];

        try {
            const { data, error } = await this.client
                .from(window.SUPABASE_CONFIG.tableName)
                .select('*')
                .order('uploaded_at', { ascending: false })
                .limit(limit);

            if (error) {
                throw error;
            }

            return data || [];
        } catch (error) {
            console.error('Error fetching upload history:', error);
            throw new Error(`Failed to fetch history: ${error.message}`);
        }
    }

    // Delete file from storage
    async deleteFile(fileName) {
        if (!this.checkConnection()) return false;

        try {
            const { error } = await this.client.storage
                .from(window.SUPABASE_CONFIG.bucketName)
                .remove([fileName]);

            if (error) {
                throw error;
            }

            return true;
        } catch (error) {
            console.error('Error deleting file:', error);
            throw new Error(`Failed to delete file: ${error.message}`);
        }
    }

    // Delete upload record from database
    async deleteUploadRecord(id) {
        if (!this.checkConnection()) return false;

        try {
            const { error } = await this.client
                .from(window.SUPABASE_CONFIG.tableName)
                .delete()
                .eq('id', id);

            if (error) {
                throw error;
            }

            return true;
        } catch (error) {
            console.error('Error deleting upload record:', error);
            throw new Error(`Failed to delete record: ${error.message}`);
        }
    }

    // Complete upload process (upload file + save metadata)
    async completeUpload(file, progressCallback) {
        if (!this.checkConnection()) return null;

        try {
            console.log('🚀 [COMPLETE UPLOAD] Starting complete upload for:', {
                name: file.name,
                size: file.size,
                type: file.type,
                constructor: file.constructor.name,
                lastModified: file.lastModified
            });

            // Generate unique filename
            const timestamp = Date.now();
            const fileName = `${timestamp}_${file.name}`;

            // Upload file to storage
            if (progressCallback) progressCallback(25, 'Uploading to storage...');
            console.log('📤 [COMPLETE UPLOAD] Calling uploadFile with:', {
                fileName,
                fileType: file.type,
                fileSize: file.size
            });
            
            const uploadResult = await this.uploadFile(file, fileName);

            // Get public URL
            if (progressCallback) progressCallback(50, 'Getting file URL...');
            const publicUrl = this.getPublicUrl(fileName);

            // Get location data - MANDATORY for all uploads
            let locationData = {};
            if (window.geolocationManager) {
                try {
                    const location = await window.geolocationManager.getLocationForUpload();
                    if (location) {
                        locationData = {
                            latitude: location.latitude,
                            longitude: location.longitude,
                            location_accuracy: location.accuracy,
                            location_timestamp: location.timestamp
                        };
                        console.log('📍 [UPLOAD] Including location data:', {
                            lat: location.latitude.toFixed(6),
                            lng: location.longitude.toFixed(6),
                            accuracy: Math.round(location.accuracy) + 'm'
                        });
                    } else {
                        throw new Error('Location is required for upload. Please enable location access.');
                    }
                } catch (error) {
                    console.error('❌ [UPLOAD] Location is mandatory for uploads:', error.message);
                    throw new Error('Location access is required for uploading. Please enable location permissions and try again.');
                }
            } else {
                throw new Error('Location service is not available. Please enable location access.');
            }

            // Prepare metadata with proper IST timestamp and location
            const now = new Date();
            // Create proper IST timestamp using timezone conversion
            const istTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
            
            const uploadData = {
                file_name: file.name,
                file_size: file.size,
                file_type: file.type,
                file_url: publicUrl,
                uploaded_at: istTime.toISOString(), // Proper IST timestamp
                ...locationData // Include location data if available
            };

            console.log('💾 [COMPLETE UPLOAD] Preparing metadata with IST timestamp:', {
                ...uploadData,
                uploaded_at_formatted: istTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                local_time: now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
            });

            // Save metadata to database
            if (progressCallback) progressCallback(75, 'Saving metadata...');
            const metadata = await this.saveUploadMetadata(uploadData);

            if (progressCallback) progressCallback(100, 'Upload complete!');

            console.log('✅ [COMPLETE UPLOAD] Upload completed successfully:', {
                storage_path: uploadResult.path,
                public_url: publicUrl,
                metadata: metadata
            });

            // Trigger automatic grain size analysis using new simple analysis service
            if (metadata && metadata.id) {
                try {
                    console.log('🔬 [ANALYSIS] Triggering automatic analysis for upload:', metadata.id);
                    
                    // Call the new simple analysis service
                    const response = await fetch('http://localhost:8001/analyze', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            upload_id: metadata.id,
                            image_url: publicUrl
                        })
                    });

                    const result = await response.json();
                    
                    if (result.success) {
                        console.log('✅ [ANALYSIS] Analysis triggered successfully:', result.analysis_id);
                    } else {
                        console.warn('⚠️ [ANALYSIS] Analysis service reported failure:', result.message);
                    }
                } catch (analysisError) {
                    console.warn('⚠️ [ANALYSIS] Failed to trigger analysis (upload still successful):', analysisError);
                    // Don't fail the upload if analysis trigger fails
                }
            }

            return {
                ...metadata,
                storage_path: uploadResult.path,
                public_url: publicUrl
            };
        } catch (error) {
            console.error('❌ [COMPLETE UPLOAD] Complete upload failed:', error);
            throw error;
        }
    }

    // Test connection to Supabase
    async testConnection() {
        if (!this.checkConnection()) return false;

        try {
            // Try to fetch a single record to test connection
            const { data, error } = await this.client
                .from(window.SUPABASE_CONFIG.tableName)
                .select('id')
                .limit(1);

            if (error && error.code === 'PGRST116') {
                // Table doesn't exist
                throw new Error('Database table not found. Please run the setup SQL commands.');
            } else if (error) {
                throw error;
            }

            return true;
        } catch (error) {
            console.error('Connection test failed:', error);
            throw error;
        }
    }

    // Utility function to show toast notifications
    showToast(message, type = 'info') {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
}

// Create global instance
window.supabaseClient = new SupabaseClient();

// Export for use in other files
window.SupabaseClient = SupabaseClient;