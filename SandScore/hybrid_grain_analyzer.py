"""
Hybrid Grain Size Analyzer
Combines fast numerical analysis with comprehensive visualization
"""

import cv2
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend for server environment
import matplotlib.pyplot as plt
import json
import io
import base64
import sys
import os
import tempfile
import traceback

# Import both analyzers
from fast_grain_analyzer import FastGrainAnalyzer, convert_numpy_types
from plot_extractor import PlotExtractorGrainAnalyzer

# Import the comprehensive analyzer (need to handle the space in filename)
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def import_comprehensive_analyzer():
    """Import the comprehensive analyzer from 'grain size.py'"""
    try:
        # Handle the space in filename by importing as a module
        spec = None
        try:
            import importlib.util
            spec = importlib.util.spec_from_file_location("grain_size", "grain size.py")
            grain_size_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(grain_size_module)
            return grain_size_module.AccurateGrainAnalyzer
        except Exception as e:
            print(f"Failed to import comprehensive analyzer: {e}")
            # Fallback: try direct import if file is renamed
            try:
                from grain_size_analyzer import AccurateGrainAnalyzer as ComprehensiveAnalyzer
                return ComprehensiveAnalyzer
            except:
                return None
    except Exception as e:
        print(f"Error importing comprehensive analyzer: {e}")
        return None

class HybridGrainAnalyzer:
    """
    Hybrid analyzer that combines:
    - Fast analyzer for numerical data (speed + accuracy)
    - Comprehensive analyzer for detailed plots and preprocessing
    """
    
    def __init__(self, known_coin_diameter_mm=20.0):  # Optimized for Indian coins
        self.coin_diameter_mm = known_coin_diameter_mm
        
        # Initialize fast analyzer for numerical data
        self.fast_analyzer = FastGrainAnalyzer(known_coin_diameter_mm=known_coin_diameter_mm)
        
        # Initialize plot extractor for comprehensive plots
        self.plot_extractor = PlotExtractorGrainAnalyzer(known_coin_diameter_mm=known_coin_diameter_mm)
        
        # Keep the original comprehensive analyzer as backup
        ComprehensiveAnalyzer = import_comprehensive_analyzer()
        if ComprehensiveAnalyzer:
            self.comprehensive_analyzer = ComprehensiveAnalyzer(known_coin_diameter_mm=known_coin_diameter_mm)
        else:
            self.comprehensive_analyzer = None
            print("⚠️  Original comprehensive analyzer not available")
        
        self.last_stats = None
        self.last_plots = {}

    def get_empty_stats(self):
        """Return empty stats structure"""
        return self.fast_analyzer.get_empty_stats()

    def process_single_image(self, image_path, min_grain_size=0.1, max_grain_size=4.0):
        """
        Process image with both analyzers:
        1. Fast analyzer for numerical data
        2. Comprehensive analyzer for detailed plots
        """
        print(f"\n{'='*60}")
        print(f"🔬 HYBRID ANALYSIS: {image_path}")
        print(f"📊 Fast analyzer: Numerical data")
        print(f"🎨 Comprehensive analyzer: Detailed plots")
        print(f"{'='*60}")
        
        try:
            # Load and validate image
            img = cv2.imread(image_path)
            if img is None:
                print(f"❌ Could not load image {image_path}")
                return self.get_empty_stats(), np.array([])
            
            print(f"📷 Image loaded: {img.shape[1]}x{img.shape[0]} pixels")
            
            # STEP 1: Fast Analysis for Numerical Data
            print(f"\n{'='*40}")
            print(f"⚡ PHASE 1: Fast Numerical Analysis")
            print(f"{'='*40}")
            
            fast_stats, fast_grain_array = self.fast_analyzer.process_single_image(
                image_path, min_grain_size, max_grain_size
            )
            
            if not fast_stats or fast_stats.get('valid_count', 0) == 0:
                print("❌ Fast analysis failed or found no grains")
                return self.get_empty_stats(), np.array([])
            
            print(f"✅ Fast analysis complete:")
            print(f"   📊 Grains found: {fast_stats['valid_count']}")
            print(f"   📊 Mean size: {fast_stats['mean']:.2f}mm")
            print(f"   📊 Size range: {fast_stats['min']:.2f}-{fast_stats['max']:.2f}mm")
            
            # STEP 2: Comprehensive Analysis for Detailed Plots
            comprehensive_plots = {}
            
            print(f"\n{'='*40}")
            print(f"🎨 PHASE 2: Comprehensive Plot Extraction")
            print(f"{'='*40}")
            
            try:
                # Use plot extractor to get all the comprehensive plots
                extracted_plots, _ = self.plot_extractor.process_single_image(
                    image_path, min_grain_size, max_grain_size
                )
                
                if extracted_plots:
                    comprehensive_plots.update(extracted_plots)
                    print(f"✅ Plot extractor generated: {len(extracted_plots)} plots")
                    for plot_name in extracted_plots.keys():
                        print(f"   📊 {plot_name}")
                else:
                    print("⚠️  Plot extractor returned no plots")
                
                # Generate additional preprocessing visualizations
                try:
                    preprocessing_plots = self.generate_preprocessing_plots(img)
                    comprehensive_plots.update(preprocessing_plots)
                    print(f"✅ Preprocessing plots added: {len(preprocessing_plots)} plots")
                except Exception as e:
                    print(f"⚠️  Preprocessing plots failed: {e}")
            
            except Exception as e:
                print(f"⚠️  Plot extraction failed: {e}")
                traceback.print_exc()
                
                # Fallback to basic preprocessing plots
                try:
                    preprocessing_plots = self.generate_preprocessing_plots(img)
                    comprehensive_plots.update(preprocessing_plots)
                    print(f"✅ Fallback preprocessing plots: {len(preprocessing_plots)} plots")
                except Exception as e2:
                    print(f"⚠️  Fallback plots also failed: {e2}")
                    comprehensive_plots = fast_stats.get('plots', {})
            
            # STEP 3: Combine Results
            print(f"\n{'='*40}")
            print(f"🔗 PHASE 3: Combining Results")
            print(f"{'='*40}")
            
            # Use fast analyzer's numerical data as the base
            combined_stats = fast_stats.copy()
            
            # Add comprehensive plots
            combined_stats['plots'] = comprehensive_plots
            combined_stats['analysis_method'] = 'hybrid'
            combined_stats['fast_analysis'] = True
            combined_stats['comprehensive_plots'] = len(comprehensive_plots) > 0
            
            # Store results
            self.last_stats = combined_stats
            self.last_plots = comprehensive_plots
            
            print(f"✅ Hybrid analysis complete:")
            print(f"   📊 Numerical data: Fast analyzer")
            print(f"   🎨 Visual plots: {len(comprehensive_plots)} comprehensive plots")
            print(f"   📈 Total grains: {combined_stats['valid_count']}")
            print(f"   📈 Mean size: {combined_stats['mean']:.2f}mm")
            
            return combined_stats, fast_grain_array
            
        except Exception as e:
            print(f"❌ Hybrid analysis failed: {e}")
            traceback.print_exc()
            return self.get_empty_stats(), np.array([])

    def generate_preprocessing_plots(self, img):
        """Generate preprocessing visualization plots"""
        plots = {}
        
        try:
            # 1. Original image - Keep this as it's useful
            fig1, ax1 = plt.subplots(1, 1, figsize=(8, 6))
            ax1.imshow(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
            ax1.set_title('Original Image')
            ax1.axis('off')
            plots['original'] = self._fig_to_base64(fig1)
            plt.close(fig1)
            
            # Removed: Grayscale conversion, Edge detection (Canny), and Binary threshold (OTSU) plots
            # as requested by user to clean up the analysis output
            
            print(f"✅ Generated {len(plots)} preprocessing plots (unwanted plots removed)")
            return plots
            
        except Exception as e:
            print(f"❌ Error generating preprocessing plots: {e}")
            return {}

    def _fig_to_base64(self, fig):
        """Convert matplotlib figure to base64 string"""
        buffer = io.BytesIO()
        fig.savefig(buffer, format='png', dpi=72, bbox_inches='tight')
        buffer.seek(0)
        plot_data = base64.b64encode(buffer.read()).decode()
        buffer.close()
        return plot_data

    def configure_coin_diameter(self, diameter_mm):
        """Configure coin diameter for all analyzers"""
        self.coin_diameter_mm = diameter_mm
        self.fast_analyzer.known_coin_diameter_mm = diameter_mm
        self.plot_extractor.known_coin_diameter_mm = diameter_mm
        if self.comprehensive_analyzer:
            self.comprehensive_analyzer.known_coin_diameter_mm = diameter_mm
        print(f"✅ All analyzers configured with coin diameter: {diameter_mm}mm")

# Main function for testing
def main():
    analyzer = HybridGrainAnalyzer()
    
    import sys
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
        stats, grain_array = analyzer.process_single_image(image_path)
        print(f"\nFinal hybrid stats:")
        print(f"Grains: {stats['valid_count']}")
        print(f"Mean: {stats['mean']:.3f}mm")
        print(f"Plots: {len(stats.get('plots', {}))}")
    else:
        print("Usage: python hybrid_grain_analyzer.py <image_path>")

if __name__ == "__main__":
    main()