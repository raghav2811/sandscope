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

class FastGrainAnalyzer:
    def __init__(self, known_coin_diameter_mm=20.0):  # Optimized for Indian coins in photos
        self.known_coin_diameter_mm = known_coin_diameter_mm
        self.px_per_mm = None
        self.coin_info = None
        self.valid_grains = []
        self.last_stats = None

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

    def _fig_to_base64(self, fig):
        """Convert matplotlib figure to base64 string"""
        buffer = io.BytesIO()
        fig.savefig(buffer, format='png', dpi=72, bbox_inches='tight')
        buffer.seek(0)
        plot_data = base64.b64encode(buffer.read()).decode()
        buffer.close()
        return plot_data

    def generate_comprehensive_plots(self, img, grain_result, stats, grain_array):
        """Generate fast, essential plots"""
        plots = {}
        
        try:
            if img is None or grain_result is None:
                print("❌ Missing data for plot generation")
                return {}
            
            print(f"🎨 Generating plots for image shape: {img.shape}")
            
            # Resize image for faster plotting (max 600px)
            height, width = img.shape[:2]
            if width > 600 or height > 600:
                scale = 600 / max(width, height)
                new_width = int(width * scale)
                new_height = int(height * scale)
                img_plot = cv2.resize(img, (new_width, new_height))
                scale_factor = scale
            else:
                img_plot = img.copy()
                scale_factor = 1.0
            
            # Scale coin info if needed
            scaled_coin_info = None
            if self.coin_info and scale_factor != 1.0:
                scaled_coin_info = {
                    'center': (
                        int(self.coin_info['center'][0] * scale_factor),
                        int(self.coin_info['center'][1] * scale_factor)
                    ),
                    'radius': int(self.coin_info['radius'] * scale_factor),
                    'diameter_px': int(self.coin_info['diameter_px'] * scale_factor)
                }
            else:
                scaled_coin_info = self.coin_info

            # 1. Original Image with All Particles
            fig1, ax1 = plt.subplots(1, 1, figsize=(8, 6))
            ax1.imshow(cv2.cvtColor(img_plot, cv2.COLOR_BGR2RGB))
            
            # Draw coin circle
            if scaled_coin_info:
                center_x, center_y = scaled_coin_info['center']
                coin_circle = Circle((center_x, center_y), 
                                   scaled_coin_info['radius'], 
                                   fill=False, color='cyan', linewidth=2)
                ax1.add_patch(coin_circle)
                ax1.text(center_x, center_y - scaled_coin_info['radius'] - 20, 
                        f'Coin: {self.known_coin_diameter_mm}mm', 
                        color='cyan', fontsize=10, ha='center')

            # Draw valid grains (scaled)
            valid_count = len(self.valid_grains)
            for grain in self.valid_grains:
                center_x, center_y = grain['center']
                if scale_factor != 1.0:
                    center_x = int(center_x * scale_factor)
                    center_y = int(center_y * scale_factor)
                    radius = int(grain['diameter_px'] * scale_factor / 2)
                else:
                    radius = int(grain['diameter_px'] / 2)
                
                # Color code by size
                size_mm = grain['diameter_mm']
                if size_mm < 0.5:
                    color = 'green'  # Fine
                elif size_mm < 1.0:
                    color = 'yellow'  # Medium
                else:
                    color = 'red'  # Coarse
                
                circle = Circle((center_x, center_y), radius, fill=False, 
                              color=color, linewidth=1)
                ax1.add_patch(circle)

            ax1.set_title(f'Grain Analysis Results\nTotal Particles: {valid_count}')
            ax1.axis('off')
            plots['original_with_particles'] = self._fig_to_base64(fig1)
            plt.close(fig1)

            # 2. Size Distribution Histogram
            if len(grain_array) > 0:
                fig2, ax2 = plt.subplots(1, 1, figsize=(8, 6))
                
                # Create bins for histogram
                bins = np.linspace(0, max(2.0, np.max(grain_array)), 20)
                ax2.hist(grain_array, bins=bins, alpha=0.7, color='steelblue', edgecolor='black')
                
                # Add statistics
                mean_size = np.mean(grain_array)
                median_size = np.median(grain_array)
                ax2.axvline(mean_size, color='red', linestyle='--', 
                           label=f'Mean: {mean_size:.2f}mm')
                ax2.axvline(median_size, color='orange', linestyle='--', 
                           label=f'Median: {median_size:.2f}mm')
                
                ax2.set_xlabel('Grain Size (mm)')
                ax2.set_ylabel('Frequency')
                ax2.set_title(f'Grain Size Distribution\n{len(grain_array)} particles')
                ax2.legend()
                ax2.grid(True, alpha=0.3)
                
                plots['size_distribution'] = self._fig_to_base64(fig2)
                plt.close(fig2)

            print(f"✅ Generated {len(plots)} plots successfully")
            return plots
            
        except Exception as e:
            print(f"❌ Error generating plots: {e}")
            import traceback
            traceback.print_exc()
            return {}

    def detect_coin_fast(self, img):
        """Fast coin detection using simplified Hough circles"""
        print("🔍 Fast coin detection...")
        
        # Quick preprocessing
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 1)
        
        # Single Hough circle detection with optimized parameters
        min_radius = min(img.shape[0], img.shape[1]) // 15
        max_radius = min(img.shape[0], img.shape[1]) // 6
        min_dist = min_radius * 2
        
        circles = cv2.HoughCircles(
            blurred, cv2.HOUGH_GRADIENT, 
            dp=1, minDist=min_dist,
            param1=100, param2=50,
            minRadius=min_radius, maxRadius=max_radius
        )
        
        if circles is not None:
            circles = np.round(circles[0, :]).astype("int")
            # Take the first (most confident) circle
            x, y, r = circles[0]
            
            self.coin_info = {
                'center': (x, y),
                'radius': r,
                'diameter_px': r * 2
            }
            
            # Calculate pixels per mm
            self.px_per_mm = (r * 2) / self.known_coin_diameter_mm
            
            print(f"✅ Coin detected: center=({x},{y}), radius={r}px")
            print(f"✅ Scale: {self.px_per_mm:.2f} pixels/mm")
            return True
        
        print("❌ No coin detected")
        return False

    def detect_grains_fast(self, img, min_grain_size_mm, max_grain_size_mm):
        """Fast grain detection with minimal preprocessing"""
        if not self.px_per_mm:
            print("❌ No pixel-to-mm conversion available")
            return []
        
        print(f"🔍 Detecting grains: {min_grain_size_mm}-{max_grain_size_mm}mm")
        
        # Convert size limits to pixels
        min_area_px = np.pi * (min_grain_size_mm * self.px_per_mm / 2) ** 2
        max_area_px = np.pi * (max_grain_size_mm * self.px_per_mm / 2) ** 2
        
        # Simple preprocessing
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Simple threshold
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Minimal morphology
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        cleaned = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
        
        # Find contours
        contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        self.valid_grains = []
        rejected_count = 0
        
        for contour in contours:
            area = cv2.contourArea(contour)
            
            # Basic size filtering
            if area < min_area_px or area > max_area_px:
                rejected_count += 1
                continue
            
            # Skip if too close to coin
            if self.coin_info:
                M = cv2.moments(contour)
                if M["m00"] != 0:
                    cx = int(M["m10"] / M["m00"])
                    cy = int(M["m01"] / M["m00"])
                    
                    coin_x, coin_y = self.coin_info['center']
                    distance_to_coin = np.sqrt((cx - coin_x)**2 + (cy - coin_y)**2)
                    
                    if distance_to_coin < self.coin_info['radius'] * 1.1:
                        rejected_count += 1
                        continue
                else:
                    rejected_count += 1
                    continue
            
            # Calculate equivalent diameter
            equivalent_diameter_px = 2 * np.sqrt(area / np.pi)
            diameter_mm = equivalent_diameter_px / self.px_per_mm
            
            grain_data = {
                'contour': contour,
                'area_px': area,
                'diameter_px': equivalent_diameter_px,
                'diameter_mm': diameter_mm,
                'center': (cx, cy)
            }
            
            self.valid_grains.append(grain_data)
        
        grain_sizes = [grain['diameter_mm'] for grain in self.valid_grains]
        
        print(f"✅ Found {len(self.valid_grains)} valid grains, rejected {rejected_count}")
        return grain_sizes, {'rejected': rejected_count}

    def analyze_grain_statistics(self, grain_sizes_and_rejections):
        """Fast statistics calculation"""
        if not grain_sizes_and_rejections or len(grain_sizes_and_rejections) < 2:
            return self.get_empty_stats(), np.array([])
        
        grain_sizes, rejections = grain_sizes_and_rejections
        
        if not grain_sizes:
            return self.get_empty_stats(), np.array([])
        
        grain_array = np.array(grain_sizes)
        
        # Basic statistics
        stats = {
            'count': len(grain_sizes),
            'valid_count': len(grain_sizes),
            'rejected_count': rejections.get('rejected', 0),
            'mean': float(np.mean(grain_array)),
            'median': float(np.median(grain_array)),
            'std': float(np.std(grain_array)),
            'min': float(np.min(grain_array)),
            'max': float(np.max(grain_array)),
            'all_sizes': grain_sizes,
            'rejection_breakdown': rejections,
            'coin_detected': bool(self.coin_info),
            'coin_diameter_px': float(self.coin_info['diameter_px']) if self.coin_info else 0.0,
            'pixels_per_mm': float(self.px_per_mm or 0)
        }
        
        # Percentiles
        if len(grain_array) > 0:
            percentiles = np.percentile(grain_array, [10, 25, 50, 75, 90])
            stats.update({
                'd10': float(percentiles[0]),
                'd25': float(percentiles[1]),
                'd50': float(percentiles[2]),
                'd75': float(percentiles[3]),
                'd90': float(percentiles[4])
            })
        
        # Sand vs stones classification
        sand_sizes = [s for s in grain_sizes if s < 2.0]
        stone_sizes = [s for s in grain_sizes if s >= 2.0]
        
        stats['sand'] = {
            'count': len(sand_sizes),
            'percentage': len(sand_sizes) / len(grain_sizes) * 100 if grain_sizes else 0,
            'mean_size': float(np.mean(sand_sizes)) if sand_sizes else 0.0,
            'sizes': sand_sizes
        }
        
        stats['stones'] = {
            'count': len(stone_sizes),
            'percentage': len(stone_sizes) / len(grain_sizes) * 100 if grain_sizes else 0,
            'mean_size': float(np.mean(stone_sizes)) if stone_sizes else 0.0,
            'sizes': stone_sizes
        }
        
        stats['composite_representative_size'] = stats['median']
        
        self.last_stats = convert_numpy_types(stats)
        return self.last_stats, grain_array

    def process_single_image(self, image_path, min_grain_size=0.1, max_grain_size=4.0):
        """Fast image processing"""
        print(f"\n{'='*50}")
        print(f"⚡ FAST Processing: {image_path}")
        print(f"Size range: {min_grain_size}-{max_grain_size}mm")
        print(f"{'='*50}")
        
        try:
            # Load image
            img = cv2.imread(image_path)
            if img is None:
                print(f"❌ Could not load image {image_path}")
                return self.get_empty_stats(), np.array([])
            
            print(f"📷 Image: {img.shape[1]}x{img.shape[0]} pixels")
            
            # Step 1: Fast coin detection
            if not self.detect_coin_fast(img):
                print("⚠️  Using estimated scale (no coin detected)")
                self.px_per_mm = min(img.shape[0], img.shape[1]) / 150  # Conservative estimate
            
            # Step 2: Fast grain detection
            grain_result = self.detect_grains_fast(img, min_grain_size, max_grain_size)
            if not grain_result:
                return self.get_empty_stats(), np.array([])
            
            # Step 3: Fast statistics
            stats, grain_array = self.analyze_grain_statistics(grain_result)
            
            # Step 4: Generate essential plots
            try:
                plots = self.generate_comprehensive_plots(img, grain_result, stats, grain_array)
                stats['plots'] = plots
            except Exception as e:
                print(f"⚠️  Plot generation failed: {e}")
                stats['plots'] = {}
            
            print(f"✅ Analysis complete: {stats['valid_count']} grains")
            print(f"📊 Size range: {stats['min']:.2f}-{stats['max']:.2f}mm")
            print(f"📊 Mean: {stats['mean']:.2f}mm, Median: {stats['median']:.2f}mm")
            
            return stats, grain_array
            
        except Exception as e:
            print(f"❌ Processing failed: {e}")
            import traceback
            traceback.print_exc()
            return self.get_empty_stats(), np.array([])

# Main function for compatibility
def main():
    analyzer = FastGrainAnalyzer()
    
    # Test with a sample image
    import sys
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
        stats, grain_array = analyzer.process_single_image(image_path)
        print(f"Final stats: {json.dumps(stats, indent=2)}")
    else:
        print("Usage: python fast_grain_analyzer.py <image_path>")

if __name__ == "__main__":
    main()