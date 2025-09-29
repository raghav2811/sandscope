// Analysis Dashboard Manager
class AnalysisDashboard {
    constructor() {
        this.analyses = [];
        this.filteredAnalyses = [];
        this.statusFilter = '';
        this.dateFilter = '';
        this.charts = {};
        this.init();
    }

    async init() {
        console.log('Initializing Analysis Dashboard...');
        
        try {
            // Wait for dependencies
            await this.waitForDependencies();
            
            // Initialize analysis manager
            this.analysisManager = new AnalysisManager(window.supabaseClient.client);
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load initial data
            await this.loadData();
            
            console.log('Analysis Dashboard initialized');
        } catch (error) {
            console.error('Failed to initialize dashboard:', error);
            this.showErrorMessage('Failed to initialize dashboard. Please check your configuration and refresh the page.');
        }
    }

    async waitForDependencies() {
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max wait time
        
        return new Promise((resolve, reject) => {
            const checkDependencies = () => {
                attempts++;
                
                if (window.supabaseClient && window.supabaseClient.isConnected && window.AnalysisManager) {
                    console.log('Dependencies loaded successfully');
                    resolve();
                } else if (attempts >= maxAttempts) {
                    console.error('Failed to load dependencies after maximum attempts');
                    // Show user-friendly error message
                    this.showErrorMessage('Failed to initialize dashboard. Please refresh the page.');
                    reject(new Error('Dependencies failed to load'));
                } else {
                    setTimeout(checkDependencies, 100);
                }
            };
            checkDependencies();
        });
    }

    showErrorMessage(message) {
        const container = document.getElementById('analysisList');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Configuration Error</h3>
                    <p>${message}</p>
                    <button onclick="window.location.reload()" class="refresh-btn">
                        <i class="fas fa-refresh"></i> Refresh Page
                    </button>
                </div>
            `;
        }
    }

    setupEventListeners() {
        const statusFilter = document.getElementById('statusFilter');
        const dateFilter = document.getElementById('dateFilter');

        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.statusFilter = e.target.value;
                this.applyFilters();
            });
        }

        if (dateFilter) {
            dateFilter.addEventListener('change', (e) => {
                this.dateFilter = e.target.value;
                this.applyFilters();
            });
        }
    }

    async loadData() {
        try {
            console.log('Loading analysis data...');
            
            // Check if analysisManager is initialized
            if (!this.analysisManager) {
                console.error('AnalysisManager not initialized');
                this.showError('Analysis manager not initialized');
                return;
            }
            
            this.analyses = await this.analysisManager.getAllAnalyses();
            console.log(`Loaded ${this.analyses.length} analyses:`, this.analyses);
            
            if (this.analyses.length === 0) {
                console.log('No analyses found');
                this.showNoAnalyses();
                return;
            }
            
            this.applyFilters();
            this.updateStatistics();
            this.renderAnalyses();
        } catch (error) {
            console.error('Failed to load analysis data:', error);
            this.showError(`Failed to load analysis data: ${error.message}`);
        }
    }

    async refreshData() {
        const refreshBtn = document.querySelector('.refresh-btn i');
        if (refreshBtn) {
            refreshBtn.classList.add('fa-spin');
        }

        try {
            window.showToast('Refreshing data...', 'info');
            await this.loadData();
            window.showToast('Data refreshed successfully', 'success');
        } catch (error) {
            window.showToast('Failed to refresh data', 'error');
        } finally {
            if (refreshBtn) {
                refreshBtn.classList.remove('fa-spin');
            }
        }
    }

    applyFilters() {
        this.filteredAnalyses = this.analyses.filter(analysis => {
            // Status filter
            if (this.statusFilter && analysis.analysis_status !== this.statusFilter) {
                return false;
            }

            // Date filter
            if (this.dateFilter) {
                const analysisDate = new Date(analysis.created_at);
                const now = new Date();
                
                switch (this.dateFilter) {
                    case 'today':
                        if (analysisDate.toDateString() !== now.toDateString()) {
                            return false;
                        }
                        break;
                    case 'week':
                        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        if (analysisDate < weekAgo) {
                            return false;
                        }
                        break;
                    case 'month':
                        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                        if (analysisDate < monthAgo) {
                            return false;
                        }
                        break;
                }
            }

            return true;
        });

        this.renderAnalyses();
    }

    updateStatistics() {
        const stats = {
            total: this.analyses.length,
            completed: this.analyses.filter(a => a.analysis_status === 'completed').length,
            processing: this.analyses.filter(a => a.analysis_status === 'processing').length,
            pending: this.analyses.filter(a => a.analysis_status === 'pending').length,
            failed: this.analyses.filter(a => a.analysis_status === 'failed').length
        };

        // Calculate average processing time for completed analyses
        const completedWithTime = this.analyses.filter(a => 
            a.analysis_status === 'completed' && a.processing_time_seconds
        );
        
        const avgTime = completedWithTime.length > 0 
            ? completedWithTime.reduce((sum, a) => sum + a.processing_time_seconds, 0) / completedWithTime.length
            : 0;

        // Update DOM
        document.getElementById('totalAnalyses').textContent = stats.total;
        document.getElementById('completedAnalyses').textContent = stats.completed;
        document.getElementById('processingAnalyses').textContent = stats.processing;
        document.getElementById('avgProcessingTime').textContent = avgTime > 0 ? `${avgTime.toFixed(1)}s` : '-';
    }

    renderAnalyses() {
        const container = document.getElementById('analysisList');
        
        if (this.filteredAnalyses.length === 0) {
            container.innerHTML = `
                <div class="no-analyses">
                    <i class="fas fa-microscope"></i>
                    <h3>No analyses found</h3>
                    <p>Upload some images to see analysis results here.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.filteredAnalyses.map(analysis => 
            this.renderAnalysisItem(analysis)
        ).join('');
    }

    renderAnalysisItem(analysis) {
        const formatted = this.analysisManager.formatAnalysisResults(analysis);
        const upload = analysis.uploads;
        
        if (!upload) {
            return ''; // Skip if no upload data
        }

        const status = analysis.analysis_status;
        const statusClass = `status-${status}`;
        const itemClass = `analysis-item ${status}`;

        const uploadDate = new Date(upload.uploaded_at).toLocaleString();
        const hasResults = formatted && status === 'completed';

        return `
            <div class="${itemClass}" onclick="window.analysisDashboard.showDetailedView('${analysis.id}')">
                <div class="analysis-item-header">
                    <div>
                        <h3 class="analysis-item-title">${upload.file_name}</h3>
                        <div class="analysis-item-meta">
                            Uploaded: ${uploadDate}
                            ${upload.capture_type ? ` • Type: ${upload.capture_type}` : ''}
                            ${upload.latitude ? ` • Location: ${upload.latitude.toFixed(4)}, ${upload.longitude.toFixed(4)}` : ''}
                        </div>
                    </div>
                    <span class="analysis-status ${statusClass}">${status}</span>
                </div>
                
                <div class="analysis-item-content">
                    <img src="${upload.file_url}" alt="${upload.file_name}" class="analysis-image" 
                         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 fill=%22%23f3f4f6%22/><text x=%2250%22 y=%2250%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%236b7280%22>No Image</text></svg>'">
                    
                    ${hasResults ? `
                        <div class="analysis-summary">
                            <div class="summary-stat">
                                <div class="summary-stat-value">${formatted.totalParticles}</div>
                                <div class="summary-stat-label">Total Particles</div>
                            </div>
                            <div class="summary-stat">
                                <div class="summary-stat-value">${formatted.statistics.representative.toFixed(2)}mm</div>
                                <div class="summary-stat-label">Representative Size</div>
                            </div>
                            <div class="summary-stat">
                                <div class="summary-stat-value">${formatted.composition.sandPercentage.toFixed(0)}%</div>
                                <div class="summary-stat-label">Sand</div>
                            </div>
                            <div class="summary-stat">
                                <div class="summary-stat-value">${formatted.composition.stonePercentage.toFixed(0)}%</div>
                                <div class="summary-stat-label">Stones</div>
                            </div>
                            <div class="summary-stat">
                                <div class="summary-stat-value">${formatted.percentiles.d50.toFixed(2)}mm</div>
                                <div class="summary-stat-label">Median (D50)</div>
                            </div>
                            <div class="summary-stat">
                                <div class="summary-stat-value">${formatted.metadata.processingTime?.toFixed(1) || '-'}s</div>
                                <div class="summary-stat-label">Processing Time</div>
                            </div>
                        </div>
                    ` : `
                        <div class="analysis-summary">
                            <div class="summary-stat">
                                <div class="summary-stat-value">
                                    ${status === 'pending' ? '⏳' : status === 'processing' ? '🔄' : status === 'failed' ? '❌' : '-'}
                                </div>
                                <div class="summary-stat-label">
                                    ${status === 'pending' ? 'Waiting to process' : 
                                      status === 'processing' ? 'Processing...' : 
                                      status === 'failed' ? 'Analysis failed' : 'No data'}
                                </div>
                            </div>
                            ${analysis.error_message ? `
                                <div class="summary-stat">
                                    <div class="summary-stat-value">⚠️</div>
                                    <div class="summary-stat-label">${analysis.error_message}</div>
                                </div>
                            ` : ''}
                            ${status === 'pending' || status === 'failed' ? `
                                <div class="summary-stat">
                                    <button onclick="event.stopPropagation(); window.analysisDashboard.retryAnalysis('${analysis.upload_id}')" 
                                            class="retry-btn">
                                        <i class="fas fa-redo"></i> Retry
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    async showDetailedView(analysisId) {
        try {
            const analysis = this.analyses.find(a => a.id === analysisId);
            if (!analysis) {
                throw new Error('Analysis not found');
            }

            const formatted = this.analysisManager.formatAnalysisResults(analysis);
            const detailedContent = document.getElementById('detailedAnalysisContent');
            
            if (analysis.analysis_status === 'completed' && formatted) {
                detailedContent.innerHTML = this.renderDetailedAnalysis(analysis, formatted);
                this.createCharts(formatted);
            } else {
                detailedContent.innerHTML = this.renderNonCompletedAnalysis(analysis);
            }

            document.getElementById('detailedView').style.display = 'flex';
        } catch (error) {
            console.error('Failed to show detailed view:', error);
            window.showToast('Failed to load detailed analysis', 'error');
        }
    }

    renderDetailedAnalysis(analysis, formatted) {
        const upload = analysis.uploads;
        
        return `
            <div style="margin-bottom: 30px;">
                <h2 style="margin: 0 0 10px 0;">${upload.file_name}</h2>
                <p style="color: var(--text-secondary); margin: 0;">
                    Uploaded: ${new Date(upload.uploaded_at).toLocaleString()}
                    ${upload.latitude ? ` • Location: ${upload.latitude.toFixed(6)}, ${upload.longitude.toFixed(6)}` : ''}
                </p>
            </div>

            <!-- Image Analysis Grid (matching the reference design) -->
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 30px;">
                
                <!-- All Detections -->
                <div class="analysis-card">
                    <h3 style="margin: 0 0 15px 0; text-align: center;">All Detections</h3>
                    <p style="text-align: center; margin: 0 0 10px 0; color: var(--text-secondary);">
                        Green=Valid (${formatted.validParticles}), Red=Rejected (${formatted.rejectedParticles})
                    </p>
                    <div style="text-align: center; background: #f5f5f5; border-radius: 8px; padding: 20px;">
                        <img src="${upload.file_url}" style="max-width: 100%; height: 200px; object-fit: cover; border-radius: 8px;">
                    </div>
                    <div style="text-align: center; margin-top: 10px;">
                        <strong>Small Stones Only (≥ 2.0mm)</strong><br>
                        Count: ${formatted.stoneParticles}
                    </div>
                </div>

                <!-- Valid Particles -->
                <div class="analysis-card">
                    <h3 style="margin: 0 0 15px 0; text-align: center;">Valid Particles (${formatted.validParticles})</h3>
                    <p style="text-align: center; margin: 0 0 10px 0; color: var(--text-secondary);">
                        Color-coded by size (Blue=Stones)
                    </p>
                    <div style="text-align: center; background: #f5f5f5; border-radius: 8px; padding: 20px;">
                        <img src="${upload.file_url}" style="max-width: 100%; height: 200px; object-fit: cover; border-radius: 8px;">
                    </div>
                    <div style="text-align: center; margin-top: 10px;">
                        <strong>Processed Image</strong><br>
                        (Used for HoughCircles)
                    </div>
                </div>

                <!-- Sand Grains Only -->
                <div class="analysis-card">
                    <h3 style="margin: 0 0 15px 0; text-align: center;">Sand Grains Only (< 2.0mm)</h3>
                    <p style="text-align: center; margin: 0 0 10px 0; color: var(--text-secondary);">
                        Count: ${formatted.sandParticles}
                    </p>
                    <div style="text-align: center; background: #f5f5f5; border-radius: 8px; padding: 20px;">
                        <img src="${upload.file_url}" style="max-width: 100%; height: 200px; object-fit: cover; border-radius: 8px;">
                    </div>
                    <div style="text-align: center; margin-top: 10px;">
                        <strong>Detection Mask</strong><br>
                        (White=Search, Black=Excluded)
                    </div>
                </div>
            </div>

            <!-- Analysis Results Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 30px;">
                
                <!-- Rejection Reasons -->
                <div class="analysis-card">
                    <h3 style="margin: 0 0 15px 0;">Rejection Reasons</h3>
                    <canvas id="rejectionChart" width="300" height="200"></canvas>
                </div>

                <!-- Size Distribution -->
                <div class="analysis-card">
                    <h3 style="margin: 0 0 15px 0;">Size Distribution (Sand & Stones)</h3>
                    <canvas id="sizeDistributionChart" width="300" height="200"></canvas>
                    <div style="margin-top: 10px; font-size: 0.9em; color: var(--text-secondary);">
                        <div>Mean: ${formatted.statistics.mean.toFixed(3)}mm</div>
                        <div>Median: ${formatted.statistics.median.toFixed(3)}mm</div>
                    </div>
                </div>

                <!-- Composition -->
                <div class="analysis-card">
                    <h3 style="margin: 0 0 15px 0;">Composition: Sand vs Stones</h3>
                    <canvas id="compositionChart" width="300" height="200"></canvas>
                    <div style="margin-top: 10px; font-size: 0.9em;">
                        <div><span style="color: #61D97F;">Sand Grains:</span> ${formatted.composition.sandPercentage.toFixed(1)}% (${formatted.sandParticles})</div>
                        <div><span style="color: #2B82F7;">Small Stones:</span> ${formatted.composition.stonePercentage.toFixed(1)}% (${formatted.stoneParticles})</div>
                    </div>
                </div>
            </div>

            <!-- Detailed Statistics -->
            <div class="analysis-card" style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 20px 0;">Detailed Statistics</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                    <div>
                        <h4 style="margin: 0 0 10px 0; color: var(--accent-color);">Size Statistics</h4>
                        <div>Mean: ${formatted.statistics.mean.toFixed(3)}mm</div>
                        <div>Median (D50): ${formatted.statistics.median.toFixed(3)}mm</div>
                        <div>Std Deviation: ${formatted.statistics.std.toFixed(3)}mm</div>
                        <div>Representative: ${formatted.statistics.representative.toFixed(3)}mm</div>
                    </div>
                    <div>
                        <h4 style="margin: 0 0 10px 0; color: var(--accent-color);">Percentiles</h4>
                        <div>D10: ${formatted.percentiles.d10.toFixed(3)}mm</div>
                        <div>D25: ${formatted.percentiles.d25.toFixed(3)}mm</div>
                        <div>D50: ${formatted.percentiles.d50.toFixed(3)}mm</div>
                        <div>D75: ${formatted.percentiles.d75.toFixed(3)}mm</div>
                        <div>D90: ${formatted.percentiles.d90.toFixed(3)}mm</div>
                    </div>
                    <div>
                        <h4 style="margin: 0 0 10px 0; color: var(--accent-color);">Coin Detection</h4>
                        <div>Detected: ${formatted.coinInfo.detected ? 'Yes' : 'No'}</div>
                        ${formatted.coinInfo.detected ? `
                            <div>Diameter: ${formatted.coinInfo.diameterPx}px</div>
                            <div>Scale: ${formatted.coinInfo.pixelsPerMm.toFixed(2)} px/mm</div>
                        ` : ''}
                    </div>
                    <div>
                        <h4 style="margin: 0 0 10px 0; color: var(--accent-color);">Processing</h4>
                        <div>Time: ${formatted.metadata.processingTime?.toFixed(2)}s</div>
                        <div>Total Particles: ${formatted.totalParticles}</div>
                        <div>Valid: ${formatted.validParticles}</div>
                        <div>Rejected: ${formatted.rejectedParticles}</div>
                    </div>
                </div>
            </div>

            <!-- Preprocessing Steps Overview -->
            ${this.renderPreprocessingSteps(analysis)}
        `;
    }

    renderPreprocessingSteps(analysis) {
        // Check if analysis has plots data
        if (!analysis.plots || Object.keys(analysis.plots).length === 0) {
            return '';
        }

        const plots = analysis.plots;
        
        const plotTitles = {
            // Fast analyzer plots
            'original_with_particles': 'Grain Analysis Results',
            'size_distribution': 'Grain Size Distribution',
            
            // Plot extractor plots (comprehensive from grain size.py)
            'preprocessing_steps': 'Preprocessing Steps Overview',
            'coin_detection': 'Coin Detection Results',
            'comprehensive_detection': 'Comprehensive Detection Analysis',
            'statistical_analysis': 'Statistical Analysis Summary',
            
            // Original comprehensive analyzer plots
            'all_detections': 'All Detections (Green=Valid, Red=Rejected)',
            'valid_particles': 'Valid Particles (Color-coded by Size)',
            'sand_grains': 'Sand Grains Only (< 2.0mm)',
            'small_stones': 'Small Stones Only (≥ 2.0mm)',
            'processed_image': 'Processed Image (Used for Detection)',
            'detection_mask': 'Detection Mask (White=Search, Black=Excluded)',
            'rejection_reasons': 'Rejection Reasons Breakdown',
            'composition': 'Composition: Sand vs Stones',
            
            // Preprocessing plots (from hybrid analyzer)
            'original': 'Original Image',
            'grayscale': 'Grayscale Conversion',
            'edges': 'Edge Detection (Canny)',
            'threshold': 'Binary Threshold (OTSU)',
            
            // Advanced comprehensive plots
            'size_histogram': 'Size Distribution Histogram',
            'cumulative_distribution': 'Cumulative Size Distribution',
            'statistical_summary': 'Statistical Summary Box Plot',
            'log_scale_distribution': 'Log-Scale Distribution',
            'shadow_correction': 'Shadow Correction Process',
            'particle_classification': 'Particle Classification by Size',
            'l_channel': 'L Channel (Luminance)',
            'clahe_enhanced': 'CLAHE Enhanced L Channel',
            'background_illumination': 'Background Illumination',
            'shadow_corrected': 'Shadow Corrected',
            'final_preprocessed': 'Final Preprocessed',
            'histogram_comparison': 'Histogram Comparison'
        };

        const plotsHtml = Object.entries(plots).map(([plotKey, plotData]) => `
            <div class="analysis-card" style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 15px 0; text-align: center;">
                    <i class="fas fa-chart-area" style="margin-right: 8px;"></i>
                    ${plotTitles[plotKey] || plotKey.replace('_', ' ').toUpperCase()}
                </h3>
                <div style="text-align: center; background: #f5f5f5; border-radius: 8px; padding: 20px;">
                    <img src="data:image/png;base64,${plotData}" 
                         alt="${plotTitles[plotKey] || plotKey}" 
                         style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                </div>
            </div>
        `).join('');

        return `
            <div class="analysis-card" style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 20px 0; text-align: center; color: var(--accent-color);">
                    <i class="fas fa-cogs" style="margin-right: 8px;"></i>
                    Analysis Plots & Preprocessing Steps
                </h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px;">
                    ${plotsHtml}
                </div>
            </div>
        `;
    }

    renderNonCompletedAnalysis(analysis) {
        const upload = analysis.uploads;
        const status = analysis.analysis_status;
        
        let statusIcon, statusMessage, statusColor;
        
        switch (status) {
            case 'pending':
                statusIcon = '⏳';
                statusMessage = 'Analysis is queued for processing';
                statusColor = '#6B7280';
                break;
            case 'processing':
                statusIcon = '🔄';
                statusMessage = 'Analysis is currently being processed';
                statusColor = '#F59E0B';
                break;
            case 'failed':
                statusIcon = '❌';
                statusMessage = 'Analysis failed to complete';
                statusColor = '#EF4444';
                break;
            default:
                statusIcon = '❓';
                statusMessage = 'Unknown status';
                statusColor = '#6B7280';
        }

        return `
            <div style="text-align: center; padding: 40px;">
                <h2 style="margin: 0 0 10px 0;">${upload.file_name}</h2>
                <p style="color: var(--text-secondary); margin: 0 0 30px 0;">
                    Uploaded: ${new Date(upload.uploaded_at).toLocaleString()}
                </p>
                
                <div style="font-size: 4em; margin-bottom: 20px;">${statusIcon}</div>
                <h3 style="color: ${statusColor}; margin: 0 0 10px 0;">${status.toUpperCase()}</h3>
                <p style="color: var(--text-secondary); margin: 0 0 20px 0;">${statusMessage}</p>
                
                ${analysis.error_message ? `
                    <div style="background: #FEE2E2; color: #991B1B; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <strong>Error:</strong> ${analysis.error_message}
                    </div>
                ` : ''}
                
                <div style="margin-top: 30px;">
                    <img src="${upload.file_url}" style="max-width: 400px; max-height: 300px; object-fit: cover; border-radius: 8px; box-shadow: var(--shadow-light);">
                </div>
                
                ${status === 'failed' ? `
                    <button onclick="window.analysisDashboard.retryAnalysis('${analysis.upload_id}')" 
                            style="margin-top: 20px; background: var(--accent-color); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">
                        Retry Analysis
                    </button>
                ` : ''}
            </div>
        `;
    }

    createCharts(formatted) {
        // Rejection Reasons Chart
        if (formatted.metadata.rejectionReasons) {
            this.createRejectionChart(formatted.metadata.rejectionReasons);
        }
        
        // Size Distribution Chart
        if (formatted.metadata.particleSizes && formatted.metadata.particleSizes.length > 0) {
            this.createSizeDistributionChart(formatted.metadata.particleSizes);
        }
        
        // Composition Chart
        this.createCompositionChart(formatted.composition);
    }

    createRejectionChart(rejectionReasons) {
        const ctx = document.getElementById('rejectionChart');
        if (!ctx || typeof Chart === 'undefined') {
            console.warn('Chart.js not available or canvas not found');
            return;
        }

        const labels = Object.keys(rejectionReasons);
        const data = Object.values(rejectionReasons);

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.map(label => label.replace('_', ' ').toUpperCase()),
                datasets: [{
                    label: 'Count',
                    data: data,
                    backgroundColor: '#EF4444',
                    borderColor: '#DC2626',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    createSizeDistributionChart(particleSizes) {
        const ctx = document.getElementById('sizeDistributionChart');
        if (!ctx || typeof Chart === 'undefined') {
            console.warn('Chart.js not available or canvas not found');
            return;
        }

        // Create histogram bins
        const bins = [];
        const binSize = 0.2; // 0.2mm bins
        const maxSize = Math.max(...particleSizes);
        const numBins = Math.ceil(maxSize / binSize);

        for (let i = 0; i < numBins; i++) {
            bins.push({
                min: i * binSize,
                max: (i + 1) * binSize,
                count: 0,
                isSand: (i + 1) * binSize < 2.0
            });
        }

        // Fill bins
        particleSizes.forEach(size => {
            const binIndex = Math.floor(size / binSize);
            if (binIndex < bins.length) {
                bins[binIndex].count++;
            }
        });

        const labels = bins.map(bin => `${bin.min.toFixed(1)}-${bin.max.toFixed(1)}`);
        const sandData = bins.map(bin => bin.isSand ? bin.count : 0);
        const stoneData = bins.map(bin => !bin.isSand ? bin.count : 0);

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Sand (< 2mm)',
                        data: sandData,
                        backgroundColor: '#10B981',
                        borderColor: '#059669',
                        borderWidth: 1
                    },
                    {
                        label: 'Stones (≥ 2mm)',
                        data: stoneData,
                        backgroundColor: '#3B82F6',
                        borderColor: '#2563EB',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Particle Size (mm)'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Count'
                        }
                    }
                }
            }
        });
    }

    createCompositionChart(composition) {
        const ctx = document.getElementById('compositionChart');
        if (!ctx || typeof Chart === 'undefined') {
            console.warn('Chart.js not available or canvas not found');
            return;
        }

        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Sand Grains', 'Small Stones'],
                datasets: [{
                    data: [composition.sandPercentage, composition.stonePercentage],
                    backgroundColor: ['#10B981', '#3B82F6'],
                    borderColor: ['#059669', '#2563EB'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    closeDetailedView() {
        document.getElementById('detailedView').style.display = 'none';
        
        // Destroy existing charts
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.charts = {};
    }

    async retryAnalysis(uploadId) {
        try {
            const upload = await this.getUploadData(uploadId);
            if (upload && upload.file_url) {
                await this.analysisManager.triggerAnalysis(uploadId, upload.file_url);
                window.showToast('Analysis retry triggered', 'success');
                this.closeDetailedView();
                setTimeout(() => this.refreshData(), 1000);
            }
        } catch (error) {
            console.error('Failed to retry analysis:', error);
            window.showToast('Failed to retry analysis', 'error');
        }
    }

    async getUploadData(uploadId) {
        try {
            const { data, error } = await window.supabaseClient.client
                .from('uploads')
                .select('*')
                .eq('id', uploadId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Failed to get upload data:', error);
            return null;
        }
    }

    showError(message) {
        const container = document.getElementById('analysisList');
        container.innerHTML = `
            <div class="no-analyses">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error</h3>
                <p>${message}</p>
                <button onclick="window.analysisDashboard.refreshData()" class="refresh-btn">
                    <i class="fas fa-sync-alt"></i>
                    Retry
                </button>
            </div>
        `;
    }

    showNoAnalyses() {
        const container = document.getElementById('analysisList');
        if (container) {
            container.innerHTML = `
                <div class="no-analyses">
                    <i class="fas fa-flask"></i>
                    <h3>No Analyses Found</h3>
                    <p>Upload some images to see analysis results here.</p>
                    <button onclick="window.location.href='index.html'" class="nav-btn">
                        <i class="fas fa-upload"></i>
                        Upload Images
                    </button>
                </div>
            `;
        }
    }

    async retryAnalysis(uploadId) {
        if (!uploadId) {
            window.showToast('Invalid upload ID', 'error');
            return;
        }

        try {
            window.showToast('Retrying analysis...', 'info');
            
            // Determine API URL based on environment
            const apiBaseUrl = window.location.hostname.includes('localhost') 
                ? 'http://localhost:8001'
                : 'https://sandscope-sandscore-api.onrender.com'; // Updated to correct Render API URL
            
            // Call the analysis API to retry processing
            const response = await fetch(`${apiBaseUrl}/analyze/${uploadId}`, {
                method: 'POST'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to retry analysis');
            }

            window.showToast('Analysis queued for retry', 'success');
            
            // Refresh the dashboard after a short delay
            setTimeout(() => {
                this.refreshData();
            }, 2000);

        } catch (error) {
            console.error('Failed to retry analysis:', error);
            window.showToast(`Failed to retry analysis: ${error.message}`, 'error');
        }
    }
}

// Export for global access
window.AnalysisDashboard = AnalysisDashboard;