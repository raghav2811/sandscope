// Analysis integration module
class AnalysisManager {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        // Use environment-specific URL
        this.analysisServiceUrl = window.location.hostname.includes('localhost') 
            ? 'http://localhost:8001'
            : 'https://sandscope-sandscore-api.onrender.com'; // Updated to correct Render API URL
    }

    /**
     * Trigger analysis for a newly uploaded image
     */
    async triggerAnalysis(uploadId, imageUrl, options = {}) {
        const defaultOptions = {
            min_particle_mm: 0.1,
            max_particle_mm: 4.0
        };
        
        const analysisOptions = { ...defaultOptions, ...options };
        
        try {
            console.log(`Triggering analysis for upload ${uploadId}`);
            
            // Create initial analysis record
            await this.createAnalysisRecord(uploadId);
            
            // Call analysis service
            const response = await fetch(`${this.analysisServiceUrl}/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    upload_id: uploadId,
                    image_url: imageUrl,
                    min_particle_mm: analysisOptions.min_particle_mm,
                    max_particle_mm: analysisOptions.max_particle_mm
                })
            });

            if (!response.ok) {
                throw new Error(`Analysis service error: ${response.status}`);
            }

            const result = await response.json();
            console.log('Analysis triggered successfully:', result);
            return result;

        } catch (error) {
            console.error('Failed to trigger analysis:', error);
            // Update analysis record with error
            await this.updateAnalysisStatus(uploadId, 'failed', error.message);
            throw error;
        }
    }

    /**
     * Create initial analysis record in database
     */
    async createAnalysisRecord(uploadId) {
        try {
            const { data, error } = await this.supabase
                .from('grain_analysis')
                .insert([
                    {
                        upload_id: uploadId,
                        analysis_status: 'pending'
                    }
                ]);

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Failed to create analysis record:', error);
            throw error;
        }
    }

    /**
     * Update analysis status
     */
    async updateAnalysisStatus(uploadId, status, errorMessage = null) {
        try {
            const updateData = {
                analysis_status: status,
                updated_at: new Date().toISOString()
            };

            if (errorMessage) {
                updateData.error_message = errorMessage;
            }

            const { data, error } = await this.supabase
                .from('grain_analysis')
                .update(updateData)
                .eq('upload_id', uploadId);

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Failed to update analysis status:', error);
            throw error;
        }
    }

    /**
     * Get analysis results for an upload
     */
    async getAnalysisResults(uploadId) {
        try {
            const { data, error } = await this.supabase
                .from('grain_analysis')
                .select('*')
                .eq('upload_id', uploadId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Failed to get analysis results:', error);
            return null;
        }
    }

    /**
     * Get all analyses with their upload information
     */
    async getAllAnalyses() {
        try {
            console.log('Fetching analyses from API first (faster)...');
            
            // Try API first as it might be faster and more reliable
            try {
                const apiData = await this.getAllAnalysesFromAPI();
                if (apiData && apiData.length > 0) {
                    console.log('Successfully fetched analyses from API:', apiData);
                    return apiData;
                }
            } catch (apiError) {
                console.log('API failed, trying Supabase:', apiError.message);
            }
            
            // Fallback to Supabase with timeout
            console.log('Fetching analyses from Supabase...');
            
            // Add timeout to the Supabase query
            const supabaseQuery = this.supabase
                .from('grain_analysis')
                .select(`
                    *,
                    uploads (
                        file_name,
                        file_url,
                        uploaded_at,
                        latitude,
                        longitude,
                        capture_type
                    )
                `)
                .order('created_at', { ascending: false });

            // Wrap the query with a shorter timeout
            const { data, error } = await this.queryWithTimeout(supabaseQuery, 5000); // 5 second timeout

            if (error) {
                console.error('Supabase error:', error);
                return []; // Return empty array instead of failing
            }
            
            console.log('Successfully fetched analyses from Supabase:', data);
            return data || [];
        } catch (error) {
            console.error('Failed to get all analyses:', error);
            return []; // Return empty array instead of throwing error
        }
    }

    /**
     * Add timeout wrapper for Supabase queries
     */
    async queryWithTimeout(queryPromise, timeoutMs = 10000) {
        return Promise.race([
            queryPromise,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
            )
        ]);
    }

    /**
     * Fallback method to get analyses directly from the API
     */
    async getAllAnalysesFromAPI() {
        try {
            console.log('Fetching analyses from API...');
            
            // Add timeout to fetch request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const response = await fetch(`${this.analysisServiceUrl}/analyses`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`API responded with status: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Handle both response formats
            if (result.success && result.data) {
                console.log('Successfully fetched analyses from API (format 1):', result.data);
                return result.data || [];
            } else if (result.analyses) {
                console.log('Successfully fetched analyses from API (format 2):', result.analyses);
                return result.analyses || [];
            } else {
                console.error('API error or unexpected format:', result);
                return [];
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('API request timed out');
                return []; // Return empty instead of throwing
            }
            console.error('Failed to get analyses from API:', error);
            return []; // Return empty instead of throwing
        }
    }

    /**
     * Listen for analysis status changes
     */
    subscribeToAnalysisUpdates(uploadId, callback) {
        const subscription = this.supabase
            .channel(`analysis-${uploadId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'grain_analysis',
                filter: `upload_id=eq.${uploadId}`
            }, callback)
            .subscribe();

        return subscription;
    }

    /**
     * Check if analysis service is available
     */
    async checkAnalysisService() {
        try {
            const response = await fetch(`${this.analysisServiceUrl}/health`);
            return response.ok;
        } catch (error) {
            console.warn('Analysis service not available:', error);
            return false;
        }
    }

    /**
     * Format analysis results for display
     */
    formatAnalysisResults(analysisData) {
        if (!analysisData || analysisData.analysis_status !== 'completed') {
            return null;
        }

        return {
            totalParticles: analysisData.total_particles,
            validParticles: analysisData.valid_particles,
            rejectedParticles: analysisData.rejected_particles,
            sandParticles: analysisData.sand_particles,
            stoneParticles: analysisData.stone_particles,
            statistics: {
                mean: analysisData.mean_size,
                median: analysisData.median_size,
                std: analysisData.std_deviation,
                representative: analysisData.representative_size
            },
            percentiles: {
                d10: analysisData.d10_size,
                d25: analysisData.d25_size,
                d50: analysisData.d50_size,
                d75: analysisData.d75_size,
                d90: analysisData.d90_size
            },
            composition: {
                sandPercentage: analysisData.sand_percentage,
                stonePercentage: analysisData.stone_percentage
            },
            coinInfo: {
                detected: analysisData.coin_detected,
                diameterPx: analysisData.coin_diameter_px,
                pixelsPerMm: analysisData.pixels_per_mm
            },
            metadata: {
                processingTime: analysisData.processing_time_seconds,
                analysisParameters: analysisData.analysis_parameters ? JSON.parse(analysisData.analysis_parameters) : null,
                particleSizes: analysisData.particle_sizes ? JSON.parse(analysisData.particle_sizes) : [],
                rejectionReasons: analysisData.rejection_reasons ? JSON.parse(analysisData.rejection_reasons) : {}
            },
            timestamps: {
                created: analysisData.created_at,
                updated: analysisData.updated_at
            }
        };
    }
}

// Export for use in other modules
window.AnalysisManager = AnalysisManager;