// Analysis integration module
class AnalysisManager {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        // Use environment-specific URL
        this.analysisServiceUrl = window.location.hostname.includes('localhost') 
            ? 'http://localhost:8001'
            : 'https://sandscore-api.onrender.com'; // Replace with your actual Render URL
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
            console.log('Fetching analyses from Supabase...');
            const { data, error } = await this.supabase
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

            if (error) {
                console.error('Supabase error:', error);
                // Fallback to direct API call
                return await this.getAllAnalysesFromAPI();
            }
            
            console.log('Successfully fetched analyses from Supabase:', data);
            return data || [];
        } catch (error) {
            console.error('Failed to get all analyses from Supabase:', error);
            // Fallback to direct API call
            return await this.getAllAnalysesFromAPI();
        }
    }

    /**
     * Fallback method to get analyses directly from the API
     */
    async getAllAnalysesFromAPI() {
        try {
            console.log('Fetching analyses from API...');
            const response = await fetch(`${this.analysisServiceUrl}/analyses`);
            const result = await response.json();
            
            if (result.success) {
                console.log('Successfully fetched analyses from API:', result.data);
                return result.data || [];
            } else {
                console.error('API error:', result.error);
                return [];
            }
        } catch (error) {
            console.error('Failed to get analyses from API:', error);
            return [];
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