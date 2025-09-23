"""
Plot Extraction Module for Comprehensive Grain Size Analysis
Extracts matplotlib figures as base64 images for web display
"""

import cv2
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
from scipy import ndimage
import json
import io
import base64
from matplotlib.patches import Circle
import matplotlib.patches as patches
import sys
import os

def convert_numpy_types(obj):
    """Convert numpy types to native Python types for JSON serialization"""
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {k: convert_numpy_types(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [convert_numpy_types(item) for item in obj]
    else:
        return obj

class PlotExtractorGrainAnalyzer:
    """Modified version of AccurateGrainAnalyzer that captures plots as base64"""
    
    def __init__(self, known_coin_diameter_mm=20.0):  # Optimized for Indian coins
        self.known_coin_diameter_mm = known_coin_diameter_mm
        self.px_per_mm = None
        self.coin_info = None
        self.valid_grains = []
        self.rejected_grains = []
        self.sand_grains = []
        self.small_stones = []
        self.captured_plots = {}
        self.last_stats = None

    def _capture_figure_as_base64(self, fig, plot_name):
        """Capture matplotlib figure as base64 string"""
        try:
            buffer = io.BytesIO()
            fig.savefig(buffer, format='png', dpi=100, bbox_inches='tight', 
                       facecolor='white', edgecolor='none')
            buffer.seek(0)
            plot_data = base64.b64encode(buffer.read()).decode()
            buffer.close()
            
            self.captured_plots[plot_name] = plot_data
            print(f"✅ Captured plot: {plot_name}")
            
            # Don't show the plot, just capture it
            plt.close(fig)
            return plot_data
        except Exception as e:
            print(f"❌ Failed to capture plot {plot_name}: {e}")
            plt.close(fig)
            return None

    def preprocess_image_for_shadows(self, img):
        """Advanced preprocessing to reduce shadow effects - WITH PLOT CAPTURE"""
        print("Applying shadow reduction preprocessing...")
        
        # Convert to LAB color space (L channel is luminance)
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l_channel, a_channel, b_channel = cv2.split(lab)
        
        # Create figure for visualization - CAPTURE THIS
        fig = plt.figure(figsize=(16, 8))
        plt.subplot(2, 4, 1)
        plt.imshow(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        plt.title('Original Image')
        plt.axis('off')
        
        plt.subplot(2, 4, 2)
        plt.imshow(l_channel, cmap='gray')
        plt.title('L Channel (Luminance)')
        plt.axis('off')
        
        # Apply CLAHE to L channel to enhance contrast while reducing shadow impact
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        cl = clahe.apply(l_channel)
        
        plt.subplot(2, 4, 3)
        plt.imshow(cl, cmap='gray')
        plt.title('CLAHE Enhanced L Channel')
        plt.axis('off')
        
        # Shadow detection using morphological operations
        kernel_size = max(15, min(img.shape[0]//20, img.shape[1]//20))
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
        
        # Morphological closing to get background illumination
        background = cv2.morphologyEx(cl, cv2.MORPH_CLOSE, kernel)
        
        plt.subplot(2, 4, 4)
        plt.imshow(background, cmap='gray')
        plt.title('Background Illumination')
        plt.axis('off')
        
        # Normalize by dividing by background (shadow removal)
        shadow_corrected = np.divide(cl.astype(np.float32), 
                                   background.astype(np.float32) + 1e-8)
        shadow_corrected = cv2.normalize(shadow_corrected, None, 0, 255, cv2.NORM_MINMAX)
        shadow_corrected = shadow_corrected.astype(np.uint8)
        
        plt.subplot(2, 4, 5)
        plt.imshow(shadow_corrected, cmap='gray')
        plt.title('Shadow Corrected')
        plt.axis('off')
        
        # Merge back to LAB and convert to BGR
        l_channel_processed = shadow_corrected
        lab_processed = cv2.merge([l_channel_processed, a_channel, b_channel])
        result = cv2.cvtColor(lab_processed, cv2.COLOR_LAB2BGR)
        
        # Additional edge-preserving smoothing
        result = cv2.edgePreservingFilter(result, flags=1, sigma_s=30, sigma_r=0.3)
        
        plt.subplot(2, 4, 6)
        plt.imshow(cv2.cvtColor(result, cv2.COLOR_BGR2RGB))
        plt.title('Final Preprocessed')
        plt.axis('off')
        
        # Show histogram comparison
        plt.subplot(2, 4, 7)
        plt.hist(l_channel.flatten(), bins=50, alpha=0.7, label='Original', color='blue')
        plt.hist(shadow_corrected.flatten(), bins=50, alpha=0.7, label='Shadow Corrected', color='red')
        plt.title('Histogram Comparison')
        plt.legend()
        plt.grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        # CAPTURE this preprocessing figure
        self._capture_figure_as_base64(fig, 'preprocessing_steps')
        
        return result

    def detect_coin_accurate(self, img):
        """Coin detection with plot capture"""
        preprocessed_img = self.preprocess_image_for_shadows(img.copy())
        gray = cv2.cvtColor(preprocessed_img, cv2.COLOR_BGR2GRAY)
        
        # Show original for debugging - CAPTURE THIS
        fig = plt.figure(figsize=(12, 4))
        plt.subplot(1, 3, 1)
        plt.imshow(gray, cmap='gray')
        plt.title('Preprocessed Image')
        plt.axis('off')
        
        # Enhanced preprocessing for metallic coin detection
        equalized = cv2.equalizeHist(gray)
        blurred = cv2.GaussianBlur(equalized, (11, 11), 0)
        
        plt.subplot(1, 3, 2)
        plt.imshow(blurred, cmap='gray')
        plt.title('Preprocessed for Detection')
        plt.axis('off')
        
        # Detect circles
        circles = cv2.HoughCircles(
            blurred, cv2.HOUGH_GRADIENT, dp=1, minDist=150,
            param1=50, param2=25, minRadius=90, maxRadius=130
        )
        
        # Visualize result
        result_img = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        
        if circles is not None:
            circles = np.round(circles[0, :]).astype("int")
            x, y, r = circles[0]
            
            self.coin_info = {'center': (x, y), 'radius': r, 'diameter_px': r * 2}
            self.px_per_mm = (r * 2) / self.known_coin_diameter_mm
            
            cv2.circle(result_img, (x, y), r, (0, 255, 0), 3)
            cv2.circle(result_img, (x, y), 2, (0, 0, 255), 3)
            
            plt.subplot(1, 3, 3)
            plt.imshow(cv2.cvtColor(result_img, cv2.COLOR_BGR2RGB))
            plt.title(f'Coin Found: {r}px radius\nScale: {self.px_per_mm:.2f} px/mm')
            plt.axis('off')
            
            # CAPTURE coin detection figure
            self._capture_figure_as_base64(fig, 'coin_detection')
            return True
        else:
            plt.subplot(1, 3, 3)
            plt.imshow(cv2.cvtColor(result_img, cv2.COLOR_BGR2RGB))
            plt.title('No Coin Detected')
            plt.axis('off')
            
            # CAPTURE even if no coin found
            self._capture_figure_as_base64(fig, 'coin_detection')
            return False

    def visualize_grain_detection(self, img, processed_img, mask):
        """Comprehensive visualization of grain detection results - WITH PLOT CAPTURE"""
        if not hasattr(self, 'valid_grains') or not hasattr(self, 'rejected_grains'):
            return
        
        # Create figure with multiple subplots - CAPTURE THIS
        fig = plt.figure(figsize=(20, 15))
        
        # 1. Original image with detections
        ax1 = plt.subplot(3, 3, 1)
        vis_img = img.copy()
        
        # Draw coin
        if self.coin_info:
            x, y, r = self.coin_info['center'][0], self.coin_info['center'][1], self.coin_info['radius']
            cv2.circle(vis_img, (x, y), r, (0, 255, 255), 3)
        
        # Draw valid grains in green
        for grain in self.valid_grains:
            center = (int(grain['center'][0]), int(grain['center'][1]))
            radius = int(grain['diameter_px'] / 2)
            cv2.circle(vis_img, center, radius, (0, 255, 0), 2)
        
        # Draw rejected grains in red
        for grain in self.rejected_grains:
            center = (int(grain['center'][0]), int(grain['center'][1]))
            radius = int(grain['diameter_px'] / 2)
            cv2.circle(vis_img, center, radius, (0, 0, 255), 1)
        
        ax1.imshow(cv2.cvtColor(vis_img, cv2.COLOR_BGR2RGB))
        ax1.set_title(f'All Detections\nGreen=Valid ({len(self.valid_grains)}), Red=Rejected ({len(self.rejected_grains)})')
        ax1.axis('off')
        
        # 2. Valid grains only with size labels and color coding
        ax2 = plt.subplot(3, 3, 2)
        valid_img = img.copy()
        
        # Draw coin
        if self.coin_info:
            x, y, r = self.coin_info['center'][0], self.coin_info['center'][1], self.coin_info['radius']
            cv2.circle(valid_img, (x, y), r, (0, 255, 255), 3)
        
        # Draw valid grains with size labels
        for grain in self.valid_grains:
            center = (int(grain['center'][0]), int(grain['center'][1]))
            radius = int(grain['diameter_px'] / 2)
            size_mm = grain['diameter_mm']
            
            # Color code by size
            if size_mm < 2.0:
                color = (0, 255, 0)  # Green for sand
            else:
                color = (255, 0, 0)  # Blue for stones
            
            cv2.circle(valid_img, center, radius, color, 2)
        
        ax2.imshow(cv2.cvtColor(valid_img, cv2.COLOR_BGR2RGB))
        ax2.set_title(f'Valid Particles ({len(self.valid_grains)})\nColor-coded by size (Blue=Stones)')
        ax2.axis('off')
        
        # Continue with remaining subplots...
        # [Rest of the visualization code with similar plot captures]
        
        plt.tight_layout()
        
        # CAPTURE the comprehensive detection visualization
        self._capture_figure_as_base64(fig, 'comprehensive_detection')

    def create_analysis_plots(self, grain_sizes):
        """Create comprehensive analysis plots - WITH PLOT CAPTURE"""
        if len(grain_sizes) == 0:
            return
        
        # Create separate arrays for sand and stones
        sand_sizes = [s for s in grain_sizes if s < 2.0]
        stone_sizes = [s for s in grain_sizes if s >= 2.0]
        
        # MAIN ANALYSIS FIGURE
        fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(14, 10))
        fig.suptitle(f'Grain Size Analysis - {len(grain_sizes)} grains', fontsize=16, fontweight='bold')
        
        # 1. Histogram with sand/stone separation
        n_bins = min(20, len(grain_sizes)//5 + 3)
        ax1.hist(grain_sizes, bins=n_bins, color='tan', alpha=0.7, edgecolor='black', label='All Particles')
        
        # Add sand and stones separately
        if len(sand_sizes) > 0:
            ax1.hist(sand_sizes, bins=n_bins, color='green', alpha=0.5, label=f'Sand (<2mm): {len(sand_sizes)}')
        
        if len(stone_sizes) > 0:
            ax1.hist(stone_sizes, bins=n_bins, color='blue', alpha=0.5, label=f'Stones (≥2mm): {len(stone_sizes)}')
        
        ax1.axvline(np.mean(grain_sizes), color='red', linestyle='--', linewidth=2,
                    label=f'Mean: {np.mean(grain_sizes):.3f}mm')
        ax1.axvline(np.median(grain_sizes), color='blue', linestyle='--', linewidth=2,
                    label=f'Median: {np.median(grain_sizes):.3f}mm')
        
        ax1.set_xlabel('Grain Size (mm)')
        ax1.set_ylabel('Count')
        ax1.set_title('Size Distribution (Sand & Stones)')
        ax1.legend()
        ax1.grid(True, alpha=0.3)
        
        # 2. Cumulative distribution
        sorted_sizes = np.sort(grain_sizes)
        cumulative = np.arange(1, len(sorted_sizes) + 1) / len(sorted_sizes) * 100
        ax2.plot(sorted_sizes, cumulative, 'b-', linewidth=3, label='All Particles')
        
        # Add D10, D50, D90 lines
        d10 = np.percentile(grain_sizes, 10)
        d50 = np.percentile(grain_sizes, 50)
        d90 = np.percentile(grain_sizes, 90)
        ax2.axvline(d10, color='green', linestyle=':', alpha=0.8, label=f'D10: {d10:.3f}mm')
        ax2.axvline(d50, color='orange', linestyle=':', alpha=0.8, label=f'D50: {d50:.3f}mm')
        ax2.axvline(d90, color='red', linestyle=':', alpha=0.8, label=f'D90: {d90:.3f}mm')
        
        ax2.set_xlabel('Grain Size (mm)')
        ax2.set_ylabel('Cumulative %')
        ax2.set_title('Cumulative Distribution')
        ax2.legend()
        ax2.grid(True, alpha=0.3)
        
        # 3. Box plot with sand/stone separation
        data_to_plot = [grain_sizes]
        labels = ['All Particles']
        colors = ['lightblue']
        
        if len(sand_sizes) > 0:
            data_to_plot.append(sand_sizes)
            labels.append(f'Sand ({len(sand_sizes)})')
            colors.append('lightgreen')
        
        if len(stone_sizes) > 0:
            data_to_plot.append(stone_sizes)
            labels.append(f'Stones ({len(stone_sizes)})')
            colors.append('lightcoral')
        
        box = ax3.boxplot(data_to_plot, labels=labels, patch_artist=True)
        
        # Color the boxes
        for patch, color in zip(box['boxes'], colors):
            patch.set_facecolor(color)
        
        ax3.set_ylabel('Grain Size (mm)')
        ax3.set_title('Statistical Summary (Sand & Stones)')
        ax3.grid(True, alpha=0.3)
        
        # 4. Log scale histogram
        log_sizes = np.log10(grain_sizes)
        ax4.hist(log_sizes, bins=15, color='orange', alpha=0.7, edgecolor='black')
        ax4.set_xlabel('Log10(Grain Size) [mm]')
        ax4.set_ylabel('Count')
        ax4.set_title('Log-Scale Distribution')
        ax4.grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        # CAPTURE the main analysis plots
        self._capture_figure_as_base64(fig, 'statistical_analysis')

    def process_single_image(self, image_path, min_grain_size=0.1, max_grain_size=2.0):
        """Process image and capture all plots"""
        print(f"🎨 PLOT EXTRACTION Processing: {image_path}")
        print("="*60)
        
        self.captured_plots = {}  # Reset plots
        
        try:
            # Load image
            img = cv2.imread(image_path)
            if img is None:
                return {}, np.array([])
            
            # Step 1: Detect coin (captures preprocessing and detection plots)
            print("\nStep 1: Coin Detection with Plot Capture")
            self.detect_coin_accurate(img)
            
            # Step 2: Detect grains (simplified version)
            print("\nStep 2: Grain Detection")
            if self.px_per_mm:
                # Simple grain detection for plot purposes
                self.valid_grains = []
                self.rejected_grains = []
                self.sand_grains = []
                self.small_stones = []
                
                # Dummy data for plot generation (replace with actual detection)
                grain_sizes = np.random.normal(1.0, 0.3, 100)  # Sample data
                grain_sizes = grain_sizes[grain_sizes > 0.1]
                
                # Create dummy grain data
                for size in grain_sizes:
                    grain_data = {
                        'diameter_mm': size,
                        'diameter_px': size * self.px_per_mm,
                        'center': (np.random.randint(50, img.shape[1]-50), 
                                 np.random.randint(50, img.shape[0]-50))
                    }
                    self.valid_grains.append(grain_data)
                    
                    if size < 2.0:
                        self.sand_grains.append(grain_data)
                    else:
                        self.small_stones.append(grain_data)
            
            # Step 3: Create analysis plots
            print("\nStep 3: Creating Analysis Plots")
            if len(self.valid_grains) > 0:
                grain_sizes = [g['diameter_mm'] for g in self.valid_grains]
                self.create_analysis_plots(grain_sizes)
            
            print(f"\n✅ Plot extraction complete: {len(self.captured_plots)} plots captured")
            for plot_name in self.captured_plots.keys():
                print(f"   📊 {plot_name}")
            
            return self.captured_plots, np.array([g['diameter_mm'] for g in self.valid_grains])
            
        except Exception as e:
            print(f"❌ Plot extraction failed: {e}")
            import traceback
            traceback.print_exc()
            return {}, np.array([])

def extract_comprehensive_plots(image_path, coin_diameter_mm=25.0):
    """Main function to extract all comprehensive plots"""
    analyzer = PlotExtractorGrainAnalyzer(known_coin_diameter_mm=coin_diameter_mm)
    plots, grain_array = analyzer.process_single_image(image_path)
    return plots

if __name__ == "__main__":
    # Test plot extraction
    import sys
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
        plots = extract_comprehensive_plots(image_path)
        print(f"Extracted {len(plots)} plots: {list(plots.keys())}")
    else:
        print("Usage: python plot_extractor.py <image_path>")