import cv2
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend for server environment
import matplotlib.pyplot as plt
from scipy import ndimage
import json
import io
import base64
from matplotlib.patches import Circle
import matplotlib.patches as patches

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

class AccurateGrainAnalyzer:
    def __init__(self, known_coin_diameter_mm=25.0):
        self.known_coin_diameter_mm = known_coin_diameter_mm
        self.px_per_mm = None
        self.coin_info = None
        self.valid_grains = []
        self.rejected_grains = []
        self.sand_grains = []  # Specifically for sand grains
        self.small_stones = []  # Specifically for small stones
        self.last_stats = None
        self._preprocessed_cache = None  # Cache for preprocessed image

    def get_empty_stats(self):
        """Return a valid empty stats structure"""
        return convert_numpy_types({
            'count': 0,
            'valid_count': 0,
            'rejected_count': 0,
            'mean': 0.0,
            'median': 0.0,
            'std': 0.0,
            'min': 0.0,
            'max': 0.0,
            'all_sizes': [],
            'rejection_breakdown': {},
            'd10': 0.0,
            'd25': 0.0,
            'd50': 0.0,
            'd75': 0.0,
            'd90': 0.0,
            'sand': {
                'count': 0,
                'percentage': 0.0,
                'mean_size': 0.0,
                'sizes': []
            },
            'stones': {
                'count': 0,
                'percentage': 0.0,
                'mean_size': 0.0,
                'sizes': []
            },
            'composite_representative_size': 0.0,
            'coin_detected': bool(self.coin_info is not None),
            'coin_diameter_px': float(self.coin_info['diameter_px']) if self.coin_info else 0.0,
            'pixels_per_mm': float(self.px_per_mm or 0)
        })

    def generate_comprehensive_plots(self, img, grain_result, stats, grain_array):
        """Generate comprehensive analysis plots similar to the sample"""
        plots = {}
        
        try:
            # Safety checks
            if img is None:
                print("❌ No image provided for plot generation")
                return {}
            if grain_result is None:
                print("❌ No grain result provided for plot generation")
                return {}
            
            print(f"🎨 Generating plots for image shape: {img.shape}")
            
            # Optimize image size for faster plot generation
            height, width = img.shape[:2]
            if width > 800 or height > 800:
                scale = 800 / max(width, height)
                new_width = int(width * scale)
                new_height = int(height * scale)
                img_plot = cv2.resize(img, (new_width, new_height))
                print(f"🔽 Resized image from {width}x{height} to {new_width}x{new_height} for plots")
                # Scale coin_info for plot
                if self.coin_info:
                    center_x, center_y = self.coin_info['center']
                    scaled_coin_info = {
                        'center': (int(center_x * scale), int(center_y * scale)),
                        'diameter_px': self.coin_info['diameter_px'] * scale
                    }
                    print(f"🎯 Scaled coin info: center={scaled_coin_info['center']}, diameter={scaled_coin_info['diameter_px']:.1f}")
                else:
                    scaled_coin_info = None
                    print("⚪ No coin info to scale")
            else:
                img_plot = img
                scaled_coin_info = self.coin_info
                print(f"📐 Using original image size for plots")
            
            grain_sizes, rejection_reasons = grain_result
            
            # 1. All Detections Plot (Green=Valid, Red=Rejected)
            fig1, ax1 = plt.subplots(1, 1, figsize=(8, 6))
            ax1.imshow(cv2.cvtColor(img_plot, cv2.COLOR_BGR2RGB))
            
            # Draw valid grains in green
            valid_count = len(grain_sizes) if grain_sizes else 0
            rejected_count = sum(rejection_reasons.values()) if rejection_reasons else 0
            
            # Add coin circle if detected
            if scaled_coin_info:
                center_x, center_y = scaled_coin_info['center']
                coin_circle = Circle((center_x, center_y), 
                                   scaled_coin_info['diameter_px']/2, 
                                   fill=False, color='cyan', linewidth=3)
                ax1.add_patch(coin_circle)
            
            ax1.set_title(f'All Detections\nGreen=Valid ({valid_count}), Red=Rejected ({rejected_count})')
            ax1.axis('off')
            plots['all_detections'] = self._fig_to_base64(fig1)
            plt.close(fig1)
            
            # 2. Valid Particles (Color-coded by size)
            fig2, ax2 = plt.subplots(1, 1, figsize=(8, 6))
            ax2.imshow(cv2.cvtColor(img_plot, cv2.COLOR_BGR2RGB))
            
            # Add coin circle
            if scaled_coin_info:
                center_x, center_y = scaled_coin_info['center']
                coin_circle = Circle((center_x, center_y), 
                                   scaled_coin_info['diameter_px']/2, 
                                   fill=False, color='cyan', linewidth=3)
                ax2.add_patch(coin_circle)
            
            ax2.set_title(f'Valid Particles ({valid_count})\nColor-coded by Size (Blue=Stones)')
            ax2.axis('off')
            plots['valid_particles'] = self._fig_to_base64(fig2)
            plt.close(fig2)
            
            # 3. Sand Grains Only
            fig3, ax3 = plt.subplots(1, 1, figsize=(8, 6))
            ax3.imshow(cv2.cvtColor(img_plot, cv2.COLOR_BGR2RGB))
            
            sand_count = stats.get('sand', {}).get('count', 0)
            
            # Add coin circle
            if scaled_coin_info:
                center_x, center_y = scaled_coin_info['center']
                coin_circle = Circle((center_x, center_y), 
                                   scaled_coin_info['diameter_px']/2, 
                                   fill=False, color='cyan', linewidth=3)
                ax3.add_patch(coin_circle)
            
            ax3.set_title(f'Sand Grains Only (< 2.0mm)\nCount: {sand_count}')
            ax3.axis('off')
            plots['sand_grains'] = self._fig_to_base64(fig3)
            plt.close(fig3)
            
            # 4. Small Stones Only
            fig4, ax4 = plt.subplots(1, 1, figsize=(8, 6))
            ax4.imshow(cv2.cvtColor(img_plot, cv2.COLOR_BGR2RGB))
            
            stones_count = stats.get('stones', {}).get('count', 0)
            
            # Add coin circle
            if scaled_coin_info:
                center_x, center_y = scaled_coin_info['center']
                coin_circle = Circle((center_x, center_y), 
                                   scaled_coin_info['diameter_px']/2, 
                                   fill=False, color='cyan', linewidth=3)
                ax4.add_patch(coin_circle)
            
            ax4.set_title(f'Small Stones Only (>= 2.0mm)\nCount: {stones_count}')
            ax4.axis('off')
            plots['small_stones'] = self._fig_to_base64(fig4)
            plt.close(fig4)
            
            # 5. Processed Image (Grayscale)
            fig5, ax5 = plt.subplots(1, 1, figsize=(8, 6))
            gray = cv2.cvtColor(img_plot, cv2.COLOR_BGR2GRAY)
            ax5.imshow(gray, cmap='gray')
            ax5.set_title('Processed Image\n(Used for HoughCircles)')
            ax5.axis('off')
            plots['processed_image'] = self._fig_to_base64(fig5)
            plt.close(fig5)
            
            # 6. Detection Mask
            fig6, ax6 = plt.subplots(1, 1, figsize=(8, 6))
            # Create a simple detection mask visualization
            mask = np.zeros_like(gray)
            if scaled_coin_info:
                center_x, center_y = scaled_coin_info['center']
                cv2.circle(mask, (int(center_x), int(center_y)), 
                          int(scaled_coin_info['diameter_px']/2), 255, -1)
            
            ax6.imshow(mask, cmap='gray')
            ax6.set_title('Detection Mask\n(White=Search, Black=Excluded)')
            ax6.axis('off')
            plots['detection_mask'] = self._fig_to_base64(fig6)
            plt.close(fig6)
            
            # 7. Size Distribution Chart
            if grain_sizes and len(grain_sizes) > 0:
                fig7, ax7 = plt.subplots(1, 1, figsize=(10, 6))
                
                # Create histogram
                bins = np.arange(0.5, 4.1, 0.1)
                sand_sizes = [s for s in grain_sizes if s < 2.0]
                stone_sizes = [s for s in grain_sizes if s >= 2.0]
                
                ax7.hist(sand_sizes, bins=bins, alpha=0.7, color='green', label=f'Sand (< 2mm): {len(sand_sizes)}')
                ax7.hist(stone_sizes, bins=bins, alpha=0.7, color='blue', label=f'Stones (>= 2mm): {len(stone_sizes)}')
                
                # Add statistics lines
                if grain_array is not None and len(grain_array) > 0:
                    mean_size = np.mean(grain_array)
                    median_size = np.median(grain_array)
                    ax7.axvline(mean_size, color='red', linestyle='--', label=f'Mean: {mean_size:.3f}mm')
                    ax7.axvline(median_size, color='black', linestyle='--', label=f'Median: {median_size:.3f}mm')
                
                ax7.set_xlabel('Particle Size (mm)')
                ax7.set_ylabel('Count')
                ax7.set_title('Size Distribution (Sand & Stones)')
                ax7.legend()
                ax7.grid(True, alpha=0.3)
                plots['size_distribution'] = self._fig_to_base64(fig7)
                plt.close(fig7)
            
            # 8. Rejection Reasons Chart
            if rejection_reasons and sum(rejection_reasons.values()) > 0:
                fig8, ax8 = plt.subplots(1, 1, figsize=(8, 6))
                
                reasons = list(rejection_reasons.keys())
                counts = list(rejection_reasons.values())
                colors = ['red', 'orange', 'yellow', 'pink'][:len(reasons)]
                
                bars = ax8.bar(reasons, counts, color=colors)
                ax8.set_ylabel('Count')
                ax8.set_title('Rejection Reasons')
                ax8.tick_params(axis='x', rotation=45)
                
                # Add count labels on bars
                for bar, count in zip(bars, counts):
                    ax8.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5, 
                            str(count), ha='center', va='bottom')
                
                plt.tight_layout()
                plots['rejection_reasons'] = self._fig_to_base64(fig8)
                plt.close(fig8)
            
            # 9. Composition Pie Chart
            fig9, ax9 = plt.subplots(1, 1, figsize=(8, 8))
            
            sand_count = stats.get('sand', {}).get('count', 0)
            stones_count = stats.get('stones', {}).get('count', 0)
            
            if sand_count > 0 or stones_count > 0:
                labels = []
                sizes = []
                colors = []
                
                if sand_count > 0:
                    labels.append(f'Sand Grains\n({sand_count})')
                    sizes.append(sand_count)
                    colors.append('#90EE90')  # Light green
                
                if stones_count > 0:
                    labels.append(f'Small Stones\n({stones_count})')
                    sizes.append(stones_count)
                    colors.append('#4682B4')  # Steel blue
                
                # Calculate percentages
                total = sand_count + stones_count
                percentages = [size/total*100 for size in sizes]
                
                wedges, texts, autotexts = ax9.pie(sizes, labels=labels, colors=colors, 
                                                  autopct='%1.1f%%', startangle=90)
                ax9.set_title('Composition: Sand vs Stones')
            else:
                ax9.text(0.5, 0.5, 'No particles detected', ha='center', va='center', 
                        transform=ax9.transAxes, fontsize=16)
                ax9.set_title('Composition: Sand vs Stones')
            
            plots['composition'] = self._fig_to_base64(fig9)
            plt.close(fig9)
            
            return plots
            
        except Exception as e:
            print(f"Error generating plots: {e}")
            import traceback
            traceback.print_exc()
            return {}

    def _fig_to_base64(self, fig):
        """Convert matplotlib figure to base64 string - optimized for speed"""
        buf = io.BytesIO()
        fig.savefig(buf, format='png', dpi=100, bbox_inches='tight')  # Reduced DPI for speed
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        buf.close()
        return img_base64

    def preprocess_image_for_shadows(self, img):
        """Advanced preprocessing to reduce shadow effects - with caching"""
        if self._preprocessed_cache is not None:
            return self._preprocessed_cache
            
        print("Applying shadow reduction preprocessing...")
        
        # Optimize image size for faster processing
        height, width = img.shape[:2]
        if width > 1024 or height > 1024:
            scale = 1024 / max(width, height)
            new_width = int(width * scale)
            new_height = int(height * scale)
            img_work = cv2.resize(img, (new_width, new_height))
        else:
            img_work = img
            scale = 1.0
        
        # Convert to LAB color space (L channel is luminance)
        lab = cv2.cvtColor(img_work, cv2.COLOR_BGR2LAB)
        l_channel, a_channel, b_channel = cv2.split(lab)
        
        # Apply CLAHE to L channel to enhance contrast while reducing shadow impact
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        cl = clahe.apply(l_channel)
        
        # Simplified shadow reduction for speed
        kernel_size = max(15, min(img_work.shape[0]//20, img_work.shape[1]//20))
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
        
        # Morphological closing to get background illumination
        background = cv2.morphologyEx(cl, cv2.MORPH_CLOSE, kernel)
        
        # Subtract background to normalize illumination
        normalized = cv2.subtract(background, cl)
        normalized = cv2.add(normalized, 127)  # Add middle gray
        
        # Merge back with original a and b channels
        merged_lab = cv2.merge([normalized, a_channel, b_channel])
        
        # Convert back to BGR
        enhanced_img = cv2.cvtColor(merged_lab, cv2.COLOR_LAB2BGR)
        
        # Scale back to original size if needed
        if scale != 1.0:
            enhanced_img = cv2.resize(enhanced_img, (width, height))
        
        # Cache the result
        self._preprocessed_cache = enhanced_img
        
        return enhanced_img
    
    def detect_coin_hough_robust(self, img):
        """Enhanced coin detection using multiple methods"""
        print("Detecting coin using robust Hough circle method...")
        
        # Preprocess image
        enhanced_img = self.preprocess_image_for_shadows(img)
        gray = cv2.cvtColor(enhanced_img, cv2.COLOR_BGR2GRAY)
        
        # Apply Gaussian blur
        blurred = cv2.GaussianBlur(gray, (9, 9), 2)
        
        # Multiple parameter sets for circle detection
        param_sets = [
            {'dp': 1, 'min_dist_factor': 0.8, 'param1': 50, 'param2': 30},
            {'dp': 1, 'min_dist_factor': 0.7, 'param1': 100, 'param2': 50},
            {'dp': 2, 'min_dist_factor': 0.9, 'param1': 100, 'param2': 40},
        ]
        
        best_circle = None
        best_score = 0
        
        for params in param_sets:
            min_dist = int(min(img.shape[0], img.shape[1]) * params['min_dist_factor'] // 4)
            min_radius = min(img.shape[0], img.shape[1]) // 12
            max_radius = min(img.shape[0], img.shape[1]) // 4
            
            circles = cv2.HoughCircles(
                blurred, cv2.HOUGH_GRADIENT, 
                dp=params['dp'], 
                minDist=min_dist,
                param1=params['param1'], 
                param2=params['param2'],
                minRadius=min_radius, 
                maxRadius=max_radius
            )
            
            if circles is not None:
                circles = np.round(circles[0, :]).astype("int")
                for (x, y, r) in circles:
                    # Score circle based on circularity and edge strength
                    mask = np.zeros(gray.shape, dtype=np.uint8)
                    cv2.circle(mask, (x, y), r, 255, -1)
                    
                    # Calculate edge strength around circle
                    edges = cv2.Canny(blurred, 50, 150)
                    circle_edge_mask = np.zeros(gray.shape, dtype=np.uint8)
                    cv2.circle(circle_edge_mask, (x, y), r, 255, 3)
                    
                    edge_score = np.sum(edges & circle_edge_mask) / (2 * np.pi * r)
                    
                    if edge_score > best_score:
                        best_score = edge_score
                        best_circle = (x, y, r)
        
        if best_circle:
            self.coin_info = {
                'center': (best_circle[0], best_circle[1]),
                'radius': best_circle[2],
                'diameter_px': best_circle[2] * 2
            }
            self.px_per_mm = (best_circle[2] * 2) / self.known_coin_diameter_mm
            print(f"Coin detected: center=({best_circle[0]}, {best_circle[1]}), radius={best_circle[2]}")
            print(f"Pixels per mm: {self.px_per_mm:.2f}")
            return True
        
        print("No coin detected")
        return False
    
    def verify_coin_size(self, img):
        """Verify that detected coin has reasonable size"""
        if not self.coin_info:
            return False
        
        img_area = img.shape[0] * img.shape[1]
        coin_area = np.pi * self.coin_info['radius'] ** 2
        coin_ratio = coin_area / img_area
        
        # Coin should occupy between 1% and 25% of image
        if 0.01 <= coin_ratio <= 0.25:
            print(f"Coin size verification passed: {coin_ratio:.1%} of image")
            return True
        else:
            print(f"Coin size verification failed: {coin_ratio:.1%} of image (should be 1-25%)")
            return False
    
    def detect_grains_improved(self, img, min_grain_size_mm, max_grain_size_mm):
        """Improved grain detection with shadow handling"""
        if not self.px_per_mm:
            print("Error: No pixel-to-mm conversion available")
            return []
        
        print(f"Detecting grains between {min_grain_size_mm}mm and {max_grain_size_mm}mm...")
        
        # Convert size limits to pixels
        min_area_px = np.pi * (min_grain_size_mm * self.px_per_mm / 2) ** 2
        max_area_px = np.pi * (max_grain_size_mm * self.px_per_mm / 2) ** 2
        
        # Enhanced preprocessing
        enhanced_img = self.preprocess_image_for_shadows(img)
        gray = cv2.cvtColor(enhanced_img, cv2.COLOR_BGR2GRAY)
        
        # Adaptive thresholding
        thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                     cv2.THRESH_BINARY, 11, 2)
        
        # Morphological operations to clean up
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel)
        
        # Find contours
        contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        self.valid_grains = []
        self.rejected_grains = []
        self.sand_grains = []
        self.small_stones = []
        
        rejection_reasons = {
            'too_small': 0,
            'too_large': 0,
            'too_elongated': 0,
            'too_close_to_coin': 0,
            'invalid_shape': 0
        }
        
        for contour in contours:
            area = cv2.contourArea(contour)
            
            if area < min_area_px:
                rejection_reasons['too_small'] += 1
                continue
            if area > max_area_px:
                rejection_reasons['too_large'] += 1
                continue
            
            # Calculate shape properties
            if len(contour) < 5:
                rejection_reasons['invalid_shape'] += 1
                continue
                
            ellipse = cv2.fitEllipse(contour)
            major_axis = max(ellipse[1])
            minor_axis = min(ellipse[1])
            
            # Reject highly elongated shapes (with safety check for division by zero)
            if minor_axis == 0 or major_axis / minor_axis > 3:
                rejection_reasons['too_elongated'] += 1
                continue
            
            # Check distance from coin center
            if self.coin_info:
                center_x, center_y = ellipse[0]
                coin_x, coin_y = self.coin_info['center']
                distance_to_coin = np.sqrt((center_x - coin_x)**2 + (center_y - coin_y)**2)
                
                if distance_to_coin < self.coin_info['radius'] * 1.2:
                    rejection_reasons['too_close_to_coin'] += 1
                    continue
            
            # Calculate equivalent diameter
            equivalent_diameter_px = 2 * np.sqrt(area / np.pi)
            diameter_mm = equivalent_diameter_px / self.px_per_mm
            
            grain_data = {
                'contour': contour,
                'area_px': area,
                'diameter_px': equivalent_diameter_px,
                'diameter_mm': diameter_mm,
                'center': ellipse[0],
                'major_axis': major_axis,
                'minor_axis': minor_axis
            }
            
            self.valid_grains.append(grain_data)
            
            # Classify as sand or stone
            if diameter_mm < 2.0:
                self.sand_grains.append(grain_data)
            else:
                self.small_stones.append(grain_data)
        
        print(f"Found {len(self.valid_grains)} valid grains")
        print(f"Sand grains (< 2mm): {len(self.sand_grains)}")
        print(f"Small stones (>= 2mm): {len(self.small_stones)}")
        print(f"Rejection breakdown: {rejection_reasons}")
        
        return [grain['diameter_mm'] for grain in self.valid_grains], rejection_reasons
    
    def analyze_grain_statistics(self, grain_sizes_and_rejections):
        """Comprehensive statistical analysis"""
        try:
            grain_sizes, rejection_reasons = grain_sizes_and_rejections
            
            if not grain_sizes:
                print("No grain sizes provided for analysis")
                # Return empty but valid stats structure
                empty_stats = self.get_empty_stats()
                if rejection_reasons:
                    empty_stats['rejected_count'] = int(sum(rejection_reasons.values()))
                    empty_stats['rejection_breakdown'] = {k: int(v) for k, v in rejection_reasons.items()}
                return empty_stats, np.array([])
            
            grain_array = np.array(grain_sizes)
            
            if len(grain_array) == 0:
                print("Empty grain array after conversion")
                # Return empty stats
                empty_stats = self.get_empty_stats()
                if rejection_reasons:
                    empty_stats['rejected_count'] = int(sum(rejection_reasons.values()))
                    empty_stats['rejection_breakdown'] = {k: int(v) for k, v in rejection_reasons.items()}
                return empty_stats, np.array([])
            
            # Basic statistics
            stats = {
                'count': int(len(grain_sizes)),
                'valid_count': int(len(self.valid_grains)),
                'rejected_count': int(sum(rejection_reasons.values()) if rejection_reasons else 0),
                'mean': float(np.mean(grain_array)),
                'median': float(np.median(grain_array)),
                'std': float(np.std(grain_array)),
                'min': float(np.min(grain_array)),
                'max': float(np.max(grain_array)),
                'all_sizes': [float(size) for size in grain_sizes],
                'rejection_breakdown': {k: int(v) for k, v in rejection_reasons.items()} if rejection_reasons else {}
            }
            
            # Percentiles
            percentiles = [10, 25, 50, 75, 90]
            for p in percentiles:
                stats[f'd{p}'] = float(np.percentile(grain_array, p))
            
            # Sand vs stones analysis
            sand_sizes = [grain['diameter_mm'] for grain in self.sand_grains] if self.sand_grains else []
            stone_sizes = [grain['diameter_mm'] for grain in self.small_stones] if self.small_stones else []
            
            total_count = len(grain_sizes)
            sand_count = len(sand_sizes)
            stone_count = len(stone_sizes)
            
            stats['sand'] = {
                'count': int(sand_count),
                'percentage': float((sand_count / total_count * 100) if total_count > 0 else 0),
                'mean_size': float(np.mean(sand_sizes)) if sand_sizes else 0.0,
                'sizes': [float(size) for size in sand_sizes]
            }
            
            stats['stones'] = {
                'count': int(stone_count),
                'percentage': float((stone_count / total_count * 100) if total_count > 0 else 0),
                'mean_size': float(np.mean(stone_sizes)) if stone_sizes else 0.0,
                'sizes': [float(size) for size in stone_sizes]
            }
            
            # Composite representative size
            if sand_count > 0 and stone_count > 0:
                # Weighted average based on count
                total_weight = sand_count + stone_count
                stats['composite_representative_size'] = float(
                    (stats['sand']['mean_size'] * sand_count + 
                     stats['stones']['mean_size'] * stone_count) / total_weight
                )
            elif sand_count > 0:
                stats['composite_representative_size'] = float(stats['sand']['mean_size'])
            elif stone_count > 0:
                stats['composite_representative_size'] = float(stats['stones']['mean_size'])
            else:
                stats['composite_representative_size'] = float(stats['mean'])
            
            # Add coin detection info
            if self.coin_info:
                stats['coin_detected'] = bool(True)
                stats['coin_diameter_px'] = float(self.coin_info.get('diameter_px', 0))
                stats['pixels_per_mm'] = float(self.px_per_mm or 0)
            else:
                stats['coin_detected'] = bool(False)
                stats['coin_diameter_px'] = float(0)
                stats['pixels_per_mm'] = float(0)
            
            # Ensure all data is JSON serializable
            stats = convert_numpy_types(stats)
            
            return stats, grain_array
            
        except Exception as e:
            print(f"Error in statistical analysis: {e}")
            import traceback
            traceback.print_exc()
            # Return empty stats instead of None
            return self.get_empty_stats(), np.array([])
    
    def process_single_image(self, image_path, min_grain_size=0.1, max_grain_size=4.0):
        """Process a single image and return comprehensive analysis"""
        print(f"\n{'='*60}")
        print(f"Processing: {image_path}")
        print(f"Particle size range: {min_grain_size}mm - {max_grain_size}mm")
        print(f"{'='*60}")
        
        try:
            # Load image
            img = cv2.imread(image_path)
            if img is None:
                print(f"Error: Could not load image {image_path}")
                return self.get_empty_stats(), np.array([])
            
            print(f"Image loaded: {img.shape[1]}x{img.shape[0]} pixels")
            
            # Step 1: Detect coin for scale
            print(f"\nStep 1: Coin Detection")
            try:
                if not self.detect_coin_hough_robust(img):
                    print("Warning: No coin detected. Using estimated scale.")
                    # Use estimated scale if no coin detected
                    self.px_per_mm = min(img.shape[0], img.shape[1]) / 100  # Rough estimate
            except Exception as e:
                print(f"Coin detection failed: {e}. Using fallback scale.")
                self.px_per_mm = min(img.shape[0], img.shape[1]) / 100
            
            # Step 1b: Verify coin size
            print(f"\nStep 1b: Coin Size Verification")
            try:
                if not self.verify_coin_size(img):
                    print("Coin size verification warning. Results may be inaccurate.")
            except Exception as e:
                print(f"Coin verification failed: {e}")
            
            # Step 2: Detect grains
            print(f"\nStep 2: Grain Detection")
            try:
                grain_result = self.detect_grains_improved(img, min_grain_size, max_grain_size)
                
                if not grain_result or not grain_result[0]:  # grain_sizes is empty
                    print("No grains detected in the image")
                    return self.get_empty_stats(), np.array([])
            except Exception as e:
                print(f"Grain detection failed: {e}")
                return self.get_empty_stats(), np.array([])
            
            # Step 3: Statistical analysis
            print(f"\nStep 3: Statistical Analysis")
            try:
                stats, grain_array = self.analyze_grain_statistics(grain_result)
                
                if stats:
                    self.last_stats = stats
                    print(f"Analysis completed successfully. Found {stats.get('count', 0)} particles.")
                    
                    # Generate comprehensive plots
                    print(f"Step 4: Generating Analysis Plots")
                    try:
                        # Ensure coin_info is valid before plot generation
                        if self.coin_info:
                            print(f"Coin info available: center={self.coin_info.get('center', 'None')}, diameter_px={self.coin_info.get('diameter_px', 'None')}")
                        else:
                            print("No coin info available for plots")
                        
                        plots = self.generate_comprehensive_plots(img, grain_result, stats, grain_array)
                        stats['plots'] = plots
                        print(f"✅ Generated {len(plots)} analysis plots successfully")
                        for plot_name in plots.keys():
                            print(f"   - {plot_name}")
                    except Exception as e:
                        print(f"❌ Plot generation failed: {e}")
                        import traceback
                        traceback.print_exc()
                        stats['plots'] = {}
                else:
                    print("Statistical analysis failed.")
                    return self.get_empty_stats(), np.array([])
                
                return stats, grain_array
                
            except Exception as e:
                print(f"Statistical analysis failed: {e}")
                return self.get_empty_stats(), np.array([])
                
        except Exception as e:
            print(f"Critical error in image processing: {e}")
            import traceback
            traceback.print_exc()
            return self.get_empty_stats(), np.array([])

# Simple usage function for sand and stone analysis
def analyze_sand_image(image_path, min_particle_mm=0.1, max_particle_mm=4.0):
    """Analyze sand image including both sand grains and small stones"""
    analyzer = AccurateGrainAnalyzer(known_coin_diameter_mm=25.0)
    return analyzer.process_single_image(image_path, min_particle_mm, max_particle_mm)