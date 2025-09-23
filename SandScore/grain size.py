import cv2
import numpy as np
import matplotlib.pyplot as plt
from scipy import ndimage

class AccurateGrainAnalyzer:
    def __init__(self, known_coin_diameter_mm=20.0):  # Optimized for typical Indian coins in photos
        self.known_coin_diameter_mm = known_coin_diameter_mm
        self.px_per_mm = None
        self.coin_info = None
        self.valid_grains = []
        self.rejected_grains = []
        self.sand_grains = []  # Specifically for sand grains
        self.small_stones = []  # Specifically for small stones

    def preprocess_image_for_shadows(self, img, fast_mode=True):
        """Advanced preprocessing to reduce shadow effects - with fast mode option"""
        if fast_mode:
            # Fast mode: skip expensive plotting for production use
            print("Applying fast shadow reduction preprocessing...")
            
            # Convert to LAB color space (L channel is luminance)
            lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
            l_channel, a_channel, b_channel = cv2.split(lab)
            
            # Apply CLAHE to L channel to enhance contrast while reducing shadow impact
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            cl = clahe.apply(l_channel)
            
            # Shadow detection using morphological operations
            kernel_size = max(15, min(img.shape[0]//20, img.shape[1]//20))
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
            
            # Morphological closing to get background illumination
            background = cv2.morphologyEx(cl, cv2.MORPH_CLOSE, kernel)
            
            # Normalize by dividing by background (shadow removal)
            shadow_corrected = np.divide(cl.astype(np.float32), 
                                       background.astype(np.float32) + 1e-8)
            shadow_corrected = cv2.normalize(shadow_corrected, None, 0, 255, cv2.NORM_MINMAX)
            shadow_corrected = shadow_corrected.astype(np.uint8)
            
            # Merge back to LAB and convert to BGR
            l_channel_processed = shadow_corrected
            lab_processed = cv2.merge([l_channel_processed, a_channel, b_channel])
            result = cv2.cvtColor(lab_processed, cv2.COLOR_LAB2BGR)
            
            # Lighter edge-preserving smoothing for speed
            result = cv2.bilateralFilter(result, 9, 75, 75)
            
            return result
        else:
            # Original full mode with visualizations for debugging
            print("Applying shadow reduction preprocessing...")
            
            # Convert to LAB color space (L channel is luminance)
            lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
            l_channel, a_channel, b_channel = cv2.split(lab)
            
            # Create figure for visualization
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
            # Create a background estimation by morphological closing
            kernel_size = max(15, min(img.shape[0]//20, img.shape[1]//20))
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
            
            # Morphological closing to get background illumination
            background = cv2.morphologyEx(cl, cv2.MORPH_CLOSE, kernel)
            
            plt.subplot(2, 4, 4)
            plt.imshow(background, cmap='gray')
            plt.title('Background Illumination')
            plt.axis('off')
            
            # Normalize by dividing by background (shadow removal)
            # Add small constant to avoid division by zero
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
            plt.show()
            
            return result

    def detect_coin_accurate(self, img):
        """More accurate coin detection focusing on the actual visible coin"""
        # First apply shadow reduction preprocessing
        preprocessed_img = self.preprocess_image_for_shadows(img.copy())
        gray = cv2.cvtColor(preprocessed_img, cv2.COLOR_BGR2GRAY)
        
        # Show original for debugging
        plt.figure(figsize=(12, 4))
        plt.subplot(1, 3, 1)
        plt.imshow(gray, cmap='gray')
        plt.title('Preprocessed Image')
        plt.axis('off')
        
        # Enhanced preprocessing for metallic coin detection
        # Apply histogram equalization to improve contrast
        equalized = cv2.equalizeHist(gray)
        
        # Gaussian blur with moderate strength
        blurred = cv2.GaussianBlur(equalized, (11, 11), 0)
        
        plt.subplot(1, 3, 2)
        plt.imshow(blurred, cmap='gray')
        plt.title('Preprocessed for Detection')
        plt.axis('off')
        
        # Try multiple detection approaches
        best_coin = None
        best_score = 0
        all_candidates = []
        
        # Approach 1: Conservative detection for clearly visible coins
        circles1 = cv2.HoughCircles(
            blurred,
            cv2.HOUGH_GRADIENT,
            dp=1,
            minDist=120,  # Reduced for better detection
            param1=45,    # Reduced sensitivity
            param2=22,    # Lower threshold for better detection
            minRadius=80,  # Adjusted for Indian coins
            maxRadius=140
        )
        
        # Approach 2: More sensitive detection
        circles2 = cv2.HoughCircles(
            blurred,
            cv2.HOUGH_GRADIENT,
            dp=1.1,       # Slightly more precise
            minDist=100,
            param1=35,    # More sensitive
            param2=18,    # Even lower threshold
            minRadius=70,  # Smaller minimum for Indian coins
            maxRadius=150
        )
        
        # Combine results
        all_circles = []
        if circles1 is not None:
            all_circles.extend(circles1[0])
        if circles2 is not None:
            all_circles.extend(circles2[0])
        
        if all_circles:
            all_circles = np.around(all_circles).astype(int)
            print(f"Found {len(all_circles)} potential coin candidates")
            
            # Remove duplicates (circles that are too close)
            unique_circles = []
            for circle in all_circles:
                x, y, r = circle
                is_duplicate = False
                for unique_circle in unique_circles:
                    ux, uy, ur = unique_circle
                    distance = np.sqrt((x - ux)**2 + (y - uy)**2)
                    if distance < 50:  # Too close, consider duplicate
                        is_duplicate = True
                        break
                if not is_duplicate:
                    unique_circles.append(circle)
            
            print(f"After removing duplicates: {len(unique_circles)} candidates")
            
            # Score each unique candidate
            for i, (x, y, r) in enumerate(unique_circles):
                if self.is_valid_coin_candidate(gray, x, y, r):
                    score = self.score_coin_detailed(gray, x, y, r)
                    all_candidates.append((score, x, y, r))
                    print(f"Candidate {i+1}: center=({x},{y}), radius={r}, score={score:.1f}")
                    
                    if score > best_score:
                        best_score = score
                        best_coin = (x, y, r)
        
        # Visualize result
        result_img = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        
        if best_coin and best_score > 35:  # Lowered threshold for better detection
            x, y, r = best_coin
            
            # Draw the detected coin
            cv2.circle(result_img, (x, y), r, (0, 255, 0), 4)
            cv2.circle(result_img, (x, y), 3, (0, 0, 255), -1)
            
            # Calculate scale
            self.px_per_mm = (2 * r) / self.known_coin_diameter_mm
            self.coin_info = (x, y, r)
            
            plt.subplot(1, 3, 3)
            plt.imshow(result_img)
            plt.title(f'Coin Found: {r}px radius\nScale: {self.px_per_mm:.2f} px/mm')
            plt.axis('off')
            
            print(f"\nCoin detected successfully!")
            print(f"Location: ({x}, {y})")
            print(f"Radius: {r} pixels")
            print(f"Scale: {self.px_per_mm:.3f} px/mm")
            print(f"Confidence: {best_score:.1f}")
            
            plt.tight_layout()
            plt.show()
            return True
        else:
            plt.subplot(1, 3, 3)
            plt.imshow(result_img)
            plt.title(f'No reliable coin found\nBest score: {best_score:.1f}')
            plt.axis('off')
            
            print(f"No reliable coin detection (best score: {best_score:.1f}, need > 40)")
            
            plt.tight_layout()
            plt.show()
            return False
    
    def is_valid_coin_candidate(self, gray, x, y, r):
        """Basic validation for coin candidates"""
        # Check bounds
        if (x - r < 10 or y - r < 10 or 
            x + r + 10 >= gray.shape[1] or y + r + 10 >= gray.shape[0]):
            return False
        
        # Check reasonable size (for typical photo distances)
        if r < 80 or r > 150:
            return False
        
        return True
    
    def score_coin_simplified(self, gray, x, y, r):
        """Simplified scoring for coin candidates - optimized for speed"""
        score = 0
        
        # Create mask for coin area
        mask = np.zeros(gray.shape, dtype=np.uint8)
        cv2.circle(mask, (x, y), r-5, 255, -1)  # Slightly smaller to avoid edge effects
        coin_pixels = gray[mask > 0]
        
        if len(coin_pixels) < 100:
            return 0
        
        # 1. Intensity uniformity (simplified)
        coin_std = np.std(coin_pixels)
        uniformity_score = max(0, 30 - coin_std * 0.5)  # Simplified calculation
        score += uniformity_score
        
        # 2. Size preference (prefer realistic coin sizes for Indian coins)
        ideal_radius = 90  # Expected radius for typical Indian coin photo (20mm coin)
        size_error = abs(r - ideal_radius)
        size_score = max(0, 25 - size_error * 0.2)  # More lenient scoring
        score += size_score
        
        # 3. Basic edge strength (simplified)
        edges = cv2.Canny(gray, 50, 150)
        edge_count = 0
        for angle in np.linspace(0, 2*np.pi, 16):  # Reduced from 32 to 16 for speed
            edge_x = int(x + r * np.cos(angle))
            edge_y = int(y + r * np.sin(angle))
            
            if (0 <= edge_x < gray.shape[1] and 0 <= edge_y < gray.shape[0]):
                if edges[edge_y, edge_x] > 0:
                    edge_count += 1
        
        edge_ratio = edge_count / 16
        edge_score = edge_ratio * 25  # Reduced weight
        score += edge_score
        
        return score
    
    def score_coin_detailed(self, gray, x, y, r):
        """Detailed scoring for coin candidates"""
        score = 0
        
        # Create mask for coin area
        mask = np.zeros(gray.shape, dtype=np.uint8)
        cv2.circle(mask, (x, y), r-5, 255, -1)  # Slightly smaller to avoid edge effects
        coin_pixels = gray[mask > 0]
        
        if len(coin_pixels) < 100:
            return 0
        
        # 1. Intensity uniformity (coins are more uniform than sand)
        coin_std = np.std(coin_pixels)
        uniformity_score = max(0, 40 - coin_std)  # Lower std = higher score
        score += uniformity_score
        print(f"    Uniformity score: {uniformity_score:.1f} (std: {coin_std:.1f})")
        
        # 2. Contrast with immediate background
        bg_mask = np.zeros(gray.shape, dtype=np.uint8)
        cv2.circle(bg_mask, (x, y), r + 25, 255, -1)
        cv2.circle(bg_mask, (x, y), r + 5, 0, -1)
        bg_pixels = gray[bg_mask > 0]
        
        if len(bg_pixels) > 100:
            coin_mean = np.mean(coin_pixels)
            bg_mean = np.mean(bg_pixels)
            contrast = abs(coin_mean - bg_mean)
            contrast_score = min(contrast * 0.8, 30)
            score += contrast_score
            print(f"    Contrast score: {contrast_score:.1f} (contrast: {contrast:.1f})")
        
        # 3. Circular edge strength
        edges = cv2.Canny(gray, 100, 200)
        edge_count = 0
        total_points = 32
        
        for angle in np.linspace(0, 2*np.pi, total_points):
            edge_x = int(x + r * np.cos(angle))
            edge_y = int(y + r * np.sin(angle))
            
            if (0 <= edge_x < gray.shape[1] and 0 <= edge_y < gray.shape[0]):
                # Check in a small neighborhood around the point
                neighborhood_sum = 0
                for dx in [-1, 0, 1]:
                    for dy in [-1, 0, 1]:
                        nx, ny = edge_x + dx, edge_y + dy
                        if (0 <= nx < edges.shape[1] and 0 <= ny < edges.shape[0]):
                            neighborhood_sum += edges[ny, nx]
                
                if neighborhood_sum > 0:
                    edge_count += 1
        
        edge_ratio = edge_count / total_points if total_points > 0 else 0
        edge_score = edge_ratio * 50
        score += edge_score
        print(f"    Edge score: {edge_score:.1f} (ratio: {edge_ratio:.2f})")
        
        # 4. Size preference (prefer realistic coin sizes for Indian coins)
        ideal_radius = 90  # Expected radius for typical Indian coin photo (20mm coin)
        size_error = abs(r - ideal_radius)
        size_score = max(0, 30 - size_error * 0.2)  # More lenient scoring
        score += size_score
        print(f"    Size score: {size_score:.1f} (error: {size_error})")
        
        return score
    
    def verify_coin_size(self, img):
        """Verify that the detected coin size is reasonable"""
        if not self.coin_info:
            return False
    
        x, y, r = self.coin_info
        expected_radius_range = (60, 140)  # Adjusted range for 20mm Indian coins in photos    
        if not (expected_radius_range[0] <= r <= expected_radius_range[1]):
            print(f"Warning: Detected coin radius {r}px seems unreasonable for 20mm Indian coin")
            print(f"Expected range: {expected_radius_range[0]}-{expected_radius_range[1]}px")
            return False
    
        # Calculate expected physical size
        calculated_diameter_mm = (2 * r) / self.px_per_mm
        expected_coin_size = self.known_coin_diameter_mm
    
        if abs(calculated_diameter_mm - expected_coin_size) > expected_coin_size * 0.3:  # 30% tolerance
            print(f"Warning: Calculated coin size {calculated_diameter_mm:.1f}mm vs expected {expected_coin_size}mm")
            return False
    
        return True

    def detect_grains_improved(self, img, min_size_mm=0.1, max_size_mm=4.0, fast_mode=True):
        """Improved detection for both sand grains and small stones - with speed optimization"""
        if self.px_per_mm is None:
            print("Need coin detection for scale calibration")
            return []
        
        # Use fast preprocessing mode for production
        preprocessed_img = self.preprocess_image_for_shadows(img.copy(), fast_mode=fast_mode)
        gray = cv2.cvtColor(preprocessed_img, cv2.COLOR_BGR2GRAY)
        
        # Create mask to exclude coin area
        mask = np.ones(gray.shape, dtype=np.uint8) * 255
        if self.coin_info:
            cv2.circle(mask, (self.coin_info[0], self.coin_info[1]), 
                      self.coin_info[2] + 20, 0, -1)
        
        # Apply mask
        masked_gray = cv2.bitwise_and(gray, gray, mask=mask)
        
        # Optimized preprocessing - lighter blur for speed
        blurred = cv2.GaussianBlur(masked_gray, (3, 3), 0)  # Reduced blur for speed
        
        # Convert size limits to pixels
        min_radius = max(1, int((min_size_mm * self.px_per_mm) / 2))
        max_radius = int((max_size_mm * self.px_per_mm) / 2)
        
        print(f"Particle detection parameters:")
        print(f"  Scale: {self.px_per_mm:.2f} px/mm")
        print(f"  Size range: {min_size_mm}-{max_size_mm} mm")
        print(f"  Radius range: {min_radius}-{max_radius} pixels")
        
        # Single optimized detection approach for speed
        all_circles = []
        
        # Optimized detection with balanced parameters
        circles = cv2.HoughCircles(
            blurred,
            cv2.HOUGH_GRADIENT,
            dp=1,
            minDist=max(3, min_radius * 1.2),  # Reduced for better detection
            param1=20,    # Lower for more sensitivity
            param2=8,     # Lower for more detections
            minRadius=min_radius,
            maxRadius=max_radius
        )
        
        if circles is not None:
            all_circles.extend(circles[0])
        
        valid_grains = []
        rejected_grains = []
        self.sand_grains = []  # Reset lists
        self.small_stones = []  # Reset lists
        
        if all_circles:
            all_circles = np.around(all_circles).astype(int)
            
            # Use Non-Maximum Suppression style approach for circle deduplication
            # Sort by radius (larger first) so we prioritize bigger detections
            if len(all_circles) > 0:
                sorted_indices = np.argsort([circle[2] for circle in all_circles])[::-1]
                sorted_circles = [all_circles[i] for i in sorted_indices]
                
                unique_circles = []
                for circle in sorted_circles:
                    x, y, r = circle
                    is_duplicate = False
                    
                    for existing_circle in unique_circles:
                        ex, ey, er = existing_circle
                        distance = np.sqrt((x - ex)**2 + (y - ey)**2)
                        
                        # If circles overlap significantly, consider it a duplicate
                        # Keep the larger one (which we already prioritized by sorting)
                        if distance < (r + er) * 0.7:  # 70% overlap threshold
                            is_duplicate = True
                            break
                            
                    if not is_duplicate:
                        unique_circles.append(circle)
            else:
                unique_circles = []
            
            print(f"Found {len(all_circles)} total circles, {len(unique_circles)} after duplicate removal")
            
            for i, (x, y, r) in enumerate(unique_circles):
                # Check if grain is in coin exclusion zone
                if self.coin_info:
                    coin_center_dist = np.sqrt((x - self.coin_info[0])**2 + (y - self.coin_info[1])**2)
                    if coin_center_dist < self.coin_info[2] + 20:
                        rejected_grains.append({
                            'center': (x, y),
                            'radius': r,
                            'reason': 'in_coin_area',
                            'diameter_mm': (2 * r) / self.px_per_mm
                        })
                        continue
                
                # Convert to mm
                diameter_mm = (2 * r) / self.px_per_mm
                
                # Size filtering
                if not (min_size_mm <= diameter_mm <= max_size_mm):
                    rejected_grains.append({
                        'center': (x, y),
                        'radius': r,
                        'reason': 'size_out_of_range',
                        'diameter_mm': diameter_mm
                    })
                    continue
                
                # Shadow and texture validation
                roi_size = max(8, r * 2)  # Larger ROI for better context
                y_start = max(0, y - int(roi_size//2))
                y_end = min(blurred.shape[0], y + int(roi_size//2))
                x_start = max(0, x - int(roi_size//2))
                x_end = min(blurred.shape[1], x + int(roi_size//2))

                if y_end > y_start and x_end > x_start:
                    roi = blurred[y_start:y_end, x_start:x_end]
                    
                    if roi.size > 0:
                        roi_std = np.std(roi)
                        roi_mean = np.mean(roi)
                        
                        # Adaptive texture threshold based on size
                        # Larger particles can have lower texture (smoother stones)
                        min_texture_threshold = max(3.0, 8.0 - r * 0.1)  # Larger radius = lower threshold
                        
                        # Also check contrast with local background
                        bg_roi_size = roi_size * 2
                        bg_y_start = max(0, y - int(bg_roi_size//2))
                        bg_y_end = min(blurred.shape[0], y + int(bg_roi_size//2))
                        bg_x_start = max(0, x - int(bg_roi_size//2))
                        bg_x_end = min(blurred.shape[1], x + int(bg_roi_size//2))
                        
                        if bg_y_end > bg_y_start and bg_x_end > bg_x_start:
                            bg_roi = blurred[bg_y_start:bg_y_end, bg_x_start:bg_x_end]
                            bg_mean = np.mean(bg_roi) if bg_roi.size > 0 else roi_mean
                            contrast = abs(roi_mean - bg_mean)
                            
                            # Shadow detection: check if region is too dark
                            is_shadow = roi_mean < np.mean(blurred) * 0.7 and roi_std < 10
                            
                            if is_shadow:
                                rejected_grains.append({
                                    'center': (x, y),
                                    'radius': r,
                                    'reason': 'shadow_region',
                                    'diameter_mm': diameter_mm,
                                    'mean_intensity': roi_mean,
                                    'texture_std': roi_std
                                })
                                continue
                            
                            # Require either good texture OR good contrast
                            if roi_std > min_texture_threshold or contrast > 10:
                                particle_type = self.classify_particle_type(diameter_mm)
                                
                                # Create grain data
                                grain_data = {
                                    'center': (x, y),
                                    'radius': r,
                                    'diameter_mm': diameter_mm,
                                    'texture_std': roi_std,
                                    'contrast': contrast,
                                    'mean_intensity': roi_mean,
                                    'particle_type': particle_type
                                }
                                
                                # Categorize as sand or stone
                                if diameter_mm < 2.0:  # Sand grains (everything below 2mm)
                                    self.sand_grains.append(grain_data)
                                else:  # Small stones (2mm and above)
                                    self.small_stones.append(grain_data)
                                
                                # Add to valid grains regardless
                                valid_grains.append(grain_data)
                            else:
                                rejected_grains.append({
                                    'center': (x, y),
                                    'radius': r,
                                    'reason': 'low_texture_low_contrast',
                                    'diameter_mm': diameter_mm,
                                    'texture_std': roi_std,
                                    'contrast': contrast,
                                    'mean_intensity': roi_mean
                                })
                        else:
                            # Fallback for edge cases
                            if roi_std > min_texture_threshold:
                                particle_type = self.classify_particle_type(diameter_mm)
                                
                                grain_data = {
                                    'center': (x, y),
                                    'radius': r,
                                    'diameter_mm': diameter_mm,
                                    'texture_std': roi_std,
                                    'mean_intensity': roi_mean,
                                    'particle_type': particle_type
                                }
                                
                                # Categorize as sand or stone
                                if diameter_mm < 2.0:
                                    self.sand_grains.append(grain_data)
                                else:
                                    self.small_stones.append(grain_data)
                                
                                valid_grains.append(grain_data)
                            else:
                                rejected_grains.append({
                                    'center': (x, y),
                                    'radius': r,
                                    'reason': 'low_texture',
                                    'diameter_mm': diameter_mm,
                                    'texture_std': roi_std,
                                    'mean_intensity': roi_mean
                                })
                else:
                    rejected_grains.append({
                        'center': (x, y),
                        'radius': r,
                        'reason': 'edge_of_image',
                        'diameter_mm': diameter_mm
                    })
        
        print(f"Valid particles after filtering: {len(valid_grains)}")
        print(f"  - Sand grains (< 2.0mm): {len(self.sand_grains)}")
        print(f"  - Small stones (>= 2.0mm): {len(self.small_stones)}")
        print(f"Rejected particles: {len(rejected_grains)}")
        
        # Store detection results for visualization
        self.valid_grains = valid_grains
        self.rejected_grains = rejected_grains
        
        # Create detailed detection visualization
        self.visualize_grain_detection(img, blurred, mask)
        
        return [grain['diameter_mm'] for grain in valid_grains]

    def classify_particle_type(self, diameter_mm):
        """Classify particle type based on size (Wentworth scale + stones)"""
        if diameter_mm < 0.0625:
            return "Silt"
        elif diameter_mm < 0.125:
            return "Very fine sand"
        elif diameter_mm < 0.25:
            return "Fine sand"
        elif diameter_mm < 0.5:
            return "Medium sand"
        elif diameter_mm < 1.0:
            return "Coarse sand"
        elif diameter_mm < 2.0:
            return "Very coarse sand"
        elif diameter_mm < 4.0:
            return "Granule"
        elif diameter_mm < 8.0:
            return "Small pebble"
        elif diameter_mm < 16.0:
            return "Pebble"
        elif diameter_mm < 32.0:
            return "Small cobble"
        elif diameter_mm < 64.0:
            return "Cobble"
        else:
            return "Stone"
    
    def visualize_grain_detection(self, img, processed_img, mask):
        """Comprehensive visualization of grain detection results"""
        if not hasattr(self, 'valid_grains') or not hasattr(self, 'rejected_grains'):
            print("No grain detection data to visualize")
            return
        
        # Create figure with multiple subplots
        fig = plt.figure(figsize=(20, 15))  # Increased height for additional subplot
        
        # 1. Original image with detections
        ax1 = plt.subplot(3, 3, 1)
        vis_img = img.copy()
        
        # Draw coin
        if self.coin_info:
            cv2.circle(vis_img, (self.coin_info[0], self.coin_info[1]), 
                      self.coin_info[2], (0, 255, 255), 4)  # Yellow for coin
            cv2.circle(vis_img, (self.coin_info[0], self.coin_info[1]), 
                      3, (0, 255, 255), -1)
        
        # Draw valid grains in green
        for grain in self.valid_grains:
            center = grain['center']
            radius = grain['radius']
            cv2.circle(vis_img, center, radius, (0, 255, 0), 2)
            cv2.circle(vis_img, center, 2, (0, 255, 0), -1)
        
        # Draw rejected grains in red
        for grain in self.rejected_grains:
            center = grain['center']
            radius = grain['radius']
            cv2.circle(vis_img, center, radius, (0, 0, 255), 2)
            cv2.circle(vis_img, center, 2, (0, 0, 255), -1)
        
        ax1.imshow(cv2.cvtColor(vis_img, cv2.COLOR_BGR2RGB))
        ax1.set_title(f'All Detections\nGreen=Valid ({len(self.valid_grains)}), Red=Rejected ({len(self.rejected_grains)})')
        ax1.axis('off')
        
        # 2. Valid grains only with size labels and color coding
        ax2 = plt.subplot(3, 3, 2)
        valid_img = img.copy()
        
        # Draw coin
        if self.coin_info:
            cv2.circle(valid_img, (self.coin_info[0], self.coin_info[1]), 
                      self.coin_info[2], (255, 255, 0), 3)
        
        # Draw valid grains with size labels
        for i, grain in enumerate(self.valid_grains):
            center = grain['center']
            radius = grain['radius']
            size_mm = grain['diameter_mm']
            
            # Use different colors for different categories
            if size_mm < 0.25:
                color = (255, 0, 255)  # Magenta for fine sand
            elif size_mm < 0.5:
                color = (0, 255, 0)    # Green for medium sand
            elif size_mm < 1.0:
                color = (0, 165, 255)  # Orange for coarse sand
            elif size_mm < 2.0:
                color = (0, 0, 255)    # Red for very coarse sand
            else:
                color = (255, 0, 0)    # Blue for small stones/granules
            
            cv2.circle(valid_img, center, radius, color, 2)
            cv2.circle(valid_img, center, 2, color, -1)
            
            # Add size label (every few grains to avoid clutter)
            if i % max(1, len(self.valid_grains) // 15) == 0:
                label = f"{size_mm:.2f}"
                cv2.putText(valid_img, label, 
                            (center[0] + radius + 2, center[1]), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)
        
        ax2.imshow(cv2.cvtColor(valid_img, cv2.COLOR_BGR2RGB))
        ax2.set_title(f'Valid Particles ({len(self.valid_grains)})\nColor-coded by size (Blue=Stones)')
        ax2.axis('off')
        
        # 3. SAND GRAINS ONLY (New visualization)
        ax3 = plt.subplot(3, 3, 3)
        sand_img = img.copy()
        
        # Draw coin
        if self.coin_info:
            cv2.circle(sand_img, (self.coin_info[0], self.coin_info[1]), 
                      self.coin_info[2], (255, 255, 0), 3)
        
        # Draw only sand grains (green)
        for grain in self.sand_grains:
            center = grain['center']
            radius = grain['radius']
            size_mm = grain['diameter_mm']
            cv2.circle(sand_img, center, radius, (0, 255, 0), 2)  # Green for sand
            cv2.circle(sand_img, center, 2, (0, 255, 0), -1)
            
            # Add size label for some grains
            if hash(str(center)) % max(1, len(self.sand_grains) // 10) == 0:
                label = f"{size_mm:.2f}"
                cv2.putText(sand_img, label, 
                            (center[0] + radius + 2, center[1]), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 0), 1)
        
        ax3.imshow(cv2.cvtColor(sand_img, cv2.COLOR_BGR2RGB))
        ax3.set_title(f'Sand Grains Only (< 2.0mm)\nCount: {len(self.sand_grains)}')
        ax3.axis('off')
        
        # 4. SMALL STONES ONLY (New visualization)
        ax4 = plt.subplot(3, 3, 4)
        stones_img = img.copy()
        
        # Draw coin
        if self.coin_info:
            cv2.circle(stones_img, (self.coin_info[0], self.coin_info[1]), 
                      self.coin_info[2], (255, 255, 0), 3)
        
        # Draw only small stones (blue)
        for grain in self.small_stones:
            center = grain['center']
            radius = grain['radius']
            size_mm = grain['diameter_mm']
            cv2.circle(stones_img, center, radius, (255, 0, 0), 3)  # Blue for stones
            cv2.circle(stones_img, center, 2, (255, 0, 0), -1)
            
            # Add size label
            label = f"{size_mm:.2f}"
            cv2.putText(stones_img, label, 
                        (center[0] + radius + 2, center[1]), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)
        
        ax4.imshow(cv2.cvtColor(stones_img, cv2.COLOR_BGR2RGB))
        ax4.set_title(f'Small Stones Only (>= 2.0mm)\nCount: {len(self.small_stones)}')
        ax4.axis('off')
        
        # 5. Processed image used for detection
        ax5 = plt.subplot(3, 3, 5)
        ax5.imshow(processed_img, cmap='gray')
        ax5.set_title('Processed Image\n(Used for HoughCircles)')
        ax5.axis('off')
        
        # 6. Mask used for grain detection
        ax6 = plt.subplot(3, 3, 6)
        ax6.imshow(mask, cmap='gray')
        ax6.set_title('Detection Mask\n(White=Search, Black=Excluded)')
        ax6.axis('off')
        
        # 7. Rejection reasons breakdown
        ax7 = plt.subplot(3, 3, 7)
        if self.rejected_grains:
            rejection_reasons = {}
            for grain in self.rejected_grains:
                reason = grain['reason']
                if reason not in rejection_reasons:
                    rejection_reasons[reason] = 0
                rejection_reasons[reason] += 1
            
            reasons = list(rejection_reasons.keys())
            counts = list(rejection_reasons.values())
            
            colors = ['red', 'orange', 'yellow', 'pink', 'purple', 'brown']
            bars = ax7.bar(reasons, counts, color=colors[:len(reasons)] if len(reasons) <= len(colors) else 'red')
            ax7.set_title('Rejection Reasons')
            ax7.set_ylabel('Count')
            
            # Add count labels on bars
            for bar, count in zip(bars, counts):
                height = bar.get_height()
                ax7.text(bar.get_x() + bar.get_width()/2., height + 0.5,
                         f'{count}', ha='center', va='bottom')
            
            plt.setp(ax7.get_xticklabels(), rotation=45, ha='right')
        else:
            ax7.text(0.5, 0.5, 'No rejections', transform=ax7.transAxes, 
                     ha='center', va='center', fontsize=12)
            ax7.set_title('Rejection Reasons')
        
        # 8. Size distribution of detected grains
        ax8 = plt.subplot(3, 3, 8)
        if self.valid_grains:
            grain_sizes = [grain['diameter_mm'] for grain in self.valid_grains]
            ax8.hist(grain_sizes, bins=min(15, len(grain_sizes)//3 + 3), 
                     color='lightblue', alpha=0.7, edgecolor='black', label='All Particles')
            
            # Add separate histograms for sand and stones
            if self.sand_grains:
                sand_sizes = [grain['diameter_mm'] for grain in self.sand_grains]
                ax8.hist(sand_sizes, bins=min(10, len(sand_sizes)//3 + 3), 
                         color='green', alpha=0.7, edgecolor='black', label='Sand (< 2mm)')
            
            if self.small_stones:
                stone_sizes = [grain['diameter_mm'] for grain in self.small_stones]
                ax8.hist(stone_sizes, bins=max(3, len(stone_sizes)//2 + 1), 
                         color='blue', alpha=0.7, edgecolor='black', label='Stones (>= 2mm)')
            
            ax8.axvline(np.mean(grain_sizes), color='red', linestyle='--', 
                        label=f'Mean: {np.mean(grain_sizes):.3f}mm')
            ax8.axvline(np.median(grain_sizes), color='blue', linestyle='--', 
                        label=f'Median: {np.median(grain_sizes):.3f}mm')
            ax8.set_xlabel('Particle Size (mm)')
            ax8.set_ylabel('Count')
            ax8.set_title('Size Distribution (Sand & Stones)')
            ax8.legend()
            ax8.grid(True, alpha=0.3)
        else:
            ax8.text(0.5, 0.5, 'No valid particles', transform=ax8.transAxes, 
                     ha='center', va='center', fontsize=12)
            ax8.set_title('Size Distribution')
        
        # 9. Sand vs Stones pie chart
        ax9 = plt.subplot(3, 3, 9)
        if len(self.sand_grains) > 0 or len(self.small_stones) > 0:
            labels = []
            sizes = []
            colors = []
            
            if len(self.sand_grains) > 0:
                labels.append(f'Sand Grains\n({len(self.sand_grains)})')
                sizes.append(len(self.sand_grains))
                colors.append('yellowgreen')
            
            if len(self.small_stones) > 0:
                labels.append(f'Small Stones\n({len(self.small_stones)})')
                sizes.append(len(self.small_stones))
                colors.append('steelblue')
            
            ax9.pie(sizes, labels=labels, colors=colors, autopct='%1.1f%%', startangle=90)
            ax9.set_title('Composition: Sand vs Stones')
        else:
            ax9.text(0.5, 0.5, 'No particles detected', transform=ax9.transAxes, 
                     ha='center', va='center', fontsize=12)
            ax9.set_title('Composition: Sand vs Stones')
        
        plt.tight_layout()
        plt.show()
        
        # Print detailed rejection analysis
        if self.rejected_grains:
            print(f"\nDetailed rejection analysis:")
            print(f"{'Reason':<25} {'Count':<8} {'Size Range (mm)':<20} {'Avg Intensity':<15}")
            print("-" * 75)
            
            rejection_analysis = {}
            for grain in self.rejected_grains:
                reason = grain['reason']
                size = grain['diameter_mm']
                intensity = grain.get('mean_intensity', 0)
                if reason not in rejection_analysis:
                    rejection_analysis[reason] = {'sizes': [], 'intensities': []}
                rejection_analysis[reason]['sizes'].append(size)
                rejection_analysis[reason]['intensities'].append(intensity)
            
            for reason, data in rejection_analysis.items():
                count = len(data['sizes'])
                if data['sizes']:
                    size_range = f"{min(data['sizes']):.3f} - {max(data['sizes']):.3f}"
                    avg_intensity = f"{np.mean(data['intensities']):.1f}"
                else:
                    size_range = "N/A"
                    avg_intensity = "N/A"
                print(f"{reason:<25} {count:<8} {size_range:<20} {avg_intensity:<15}")
        
        # Print sample of detected grains
        if self.valid_grains:
            print(f"\nSample of detected particles:")
            print(f"{'#':<4} {'Position':<12} {'Radius':<8} {'Size (mm)':<12} {'Category':<12} {'Texture':<10} {'Intensity':<10} {'Type':<15}")
            print("-" * 110)
            
            # Show first 10 grains as examples
            for i, grain in enumerate(self.valid_grains[:10]):
                pos = f"({grain['center'][0]},{grain['center'][1]})"
                radius = f"{grain['radius']}px"
                size = f"{grain['diameter_mm']:.3f}"
                category = "Sand" if grain['diameter_mm'] < 2.0 else "Stone"
                texture = f"{grain.get('texture_std', 0):.1f}" if 'texture_std' in grain else "N/A"
                intensity = f"{grain.get('mean_intensity', 0):.1f}" if 'mean_intensity' in grain else "N/A"
                ptype = grain['particle_type']
                
                print(f"{i+1:<4} {pos:<12} {radius:<8} {size:<12} {category:<12} {texture:<10} {intensity:<10} {ptype:<15}")
            
            if len(self.valid_grains) > 10:
                print(f"... and {len(self.valid_grains) - 10} more particles")
        
        # Summary with sand/stone breakdown
        total_detections = len(self.valid_grains) + len(self.rejected_grains)
        if total_detections > 0:
            print(f"\nDetection Summary:")
            print(f"Total circles found: {total_detections}")
            print(f"Valid particles: {len(self.valid_grains)}")
            print(f"  ├─ Sand grains (< 2.0mm): {len(self.sand_grains)}")
            print(f"  └─ Small stones (>= 2.0mm): {len(self.small_stones)}")
            print(f"Rejected: {len(self.rejected_grains)}")
            print(f"Success rate: {len(self.valid_grains)/total_detections*100:.1f}%")

    def analyze_grain_statistics(self, grain_sizes):
        """Comprehensive grain analysis"""
        if not grain_sizes:
            print("No grains detected for analysis")
            return None, None
        
        grain_sizes = np.array(grain_sizes)
        
        # Calculate statistics
        stats = {
            'count': len(grain_sizes),
            'mean': np.mean(grain_sizes),
            'median': np.median(grain_sizes),
            'std': np.std(grain_sizes),
            'min': np.min(grain_sizes),
            'max': np.max(grain_sizes),
            'd10': np.percentile(grain_sizes, 10),
            'd50': np.percentile(grain_sizes, 50),
            'd90': np.percentile(grain_sizes, 90)
        }
        
        # Separate statistics for sand and stones if available
        if hasattr(self, 'sand_grains') and hasattr(self, 'small_stones'):
            if len(self.sand_grains) > 0:
                sand_sizes = [g['diameter_mm'] for g in self.sand_grains]
                stats['sand'] = {
                    'count': len(sand_sizes),
                    'mean': np.mean(sand_sizes),
                    'median': np.median(sand_sizes),
                    'std': np.std(sand_sizes),
                    'min': np.min(sand_sizes),
                    'max': np.max(sand_sizes)
                }
            
            if len(self.small_stones) > 0:
                stone_sizes = [g['diameter_mm'] for g in self.small_stones]
                stats['stones'] = {
                    'count': len(stone_sizes),
                    'mean': np.mean(stone_sizes),
                    'median': np.median(stone_sizes),
                    'std': np.std(stone_sizes),
                    'min': np.min(stone_sizes),
                    'max': np.max(stone_sizes)
                }
        
        # Grain size classification (Wentworth scale)
        def classify_grain_size(size_mm):
            if size_mm < 0.0625:
                return "Silt"
            elif size_mm < 0.125:
                return "Very fine sand"
            elif size_mm < 0.25:
                return "Fine sand"
            elif size_mm < 0.5:
                return "Medium sand"
            elif size_mm < 1.0:
                return "Coarse sand"
            elif size_mm < 2.0:
                return "Very coarse sand"
            else:
                return "Granule"
        
        # Classify all grains
        classifications = [classify_grain_size(size) for size in grain_sizes]
        unique_classes, counts = np.unique(classifications, return_counts=True)
        
        # Print results
        print(f"\n=== GRAIN SIZE ANALYSIS RESULTS ===")
        print(f"Total grains analyzed: {stats['count']}")
        print(f"Mean grain size: {stats['mean']:.3f} ± {stats['std']:.3f} mm")
        print(f"Median grain size: {stats['median']:.3f} mm")
        print(f"Size range: {stats['min']:.3f} - {stats['max']:.3f} mm")
        print(f"D10: {stats['d10']:.3f} mm")
        print(f"D50: {stats['d50']:.3f} mm")
        print(f"D90: {stats['d90']:.3f} mm")
        
        # Print sand/stone breakdown if available
        if 'sand' in stats:
            print(f"\nSand Grains (< 2.0mm) Analysis:")
            print(f"  Count: {stats['sand']['count']}")
            print(f"  Mean size: {stats['sand']['mean']:.3f} mm")
            print(f"  Median size: {stats['sand']['median']:.3f} mm")
            print(f"  Size range: {stats['sand']['min']:.3f} - {stats['sand']['max']:.3f} mm")
        
        if 'stones' in stats:
            print(f"\nSmall Stones (>= 2.0mm) Analysis:")
            print(f"  Count: {stats['stones']['count']}")
            print(f"  Mean size: {stats['stones']['mean']:.3f} mm")
            print(f"  Median size: {stats['stones']['median']:.3f} mm")
            print(f"  Size range: {stats['stones']['min']:.3f} - {stats['stones']['max']:.3f} mm")
        
        print(f"\nGrain size classification:")
        for class_name, count in zip(unique_classes, counts):
            percentage = (count / stats['count']) * 100
            print(f"  {class_name}: {count} grains ({percentage:.1f}%)")

        # >>>>>>>>>>>>>>>>>>> NEW: Composite Representative Size Based on Dominance <<<<<<<<<<<<<<<<<<<
        composite_representative_size = None

        if 'sand' in stats and 'stones' in stats:
            sand_count = stats['sand']['count']
            stone_count = stats['stones']['count']
            sand_median = stats['sand']['median']
            stone_median = stats['stones']['median']

            if sand_count >= stone_count:
                composite_representative_size = sand_median
                dominant_class = "Sand"
            else:
                composite_representative_size = stone_median
                dominant_class = "Stones"

            weighted_mean = (sand_count * sand_median + stone_count * stone_median) / (sand_count + stone_count)

            print(f"\n🔷 Composite Representative Size (Dominant Class Median): {composite_representative_size:.3f} mm ({dominant_class})")
            print(f"   Weighted Mean Size: {weighted_mean:.3f} mm")

        elif 'sand' in stats:
            composite_representative_size = stats['sand']['median']
            print(f"\n🔷 Composite Representative Size: {composite_representative_size:.3f} mm (Sand Only)")
        elif 'stones' in stats:
            composite_representative_size = stats['stones']['median']
            print(f"\n🔷 Composite Representative Size: {composite_representative_size:.3f} mm (Stones Only)")
        else:
            composite_representative_size = stats['median']
            print(f"\n🔷 Composite Representative Size: {composite_representative_size:.3f} mm (All Particles)")

        stats['composite_representative_size'] = composite_representative_size
        # >>>>>>>>>>>>>>>>>>> END NEW SECTION <<<<<<<<<<<<<<<<<<<

        return stats, grain_sizes
    
    def create_analysis_plots(self, grain_sizes):
        """Create comprehensive analysis plots"""
        if len(grain_sizes) == 0:
            print("No grain data to plot")
            return
        
        # Create separate arrays for sand and stones if available
        sand_sizes = []
        stone_sizes = []
        
        if hasattr(self, 'sand_grains') and hasattr(self, 'small_stones'):
            sand_sizes = [g['diameter_mm'] for g in self.sand_grains]
            stone_sizes = [g['diameter_mm'] for g in self.small_stones]
        
        fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(14, 10))
        fig.suptitle(f'Grain Size Analysis - {len(grain_sizes)} grains', fontsize=16, fontweight='bold')
        
        # 1. Histogram with sand/stone separation
        n_bins = min(20, len(grain_sizes)//5 + 3)
        ax1.hist(grain_sizes, bins=n_bins, color='tan', alpha=0.7, edgecolor='black', label='All Particles')
        
        # Add sand and stones separately if available
        if len(sand_sizes) > 0:
            ax1.hist(sand_sizes, bins=max(5, len(sand_sizes)//5 + 3), 
                     color='green', alpha=0.7, edgecolor='black', label='Sand (< 2mm)')
        
        if len(stone_sizes) > 0:
            ax1.hist(stone_sizes, bins=max(3, len(stone_sizes)//2 + 1), 
                     color='blue', alpha=0.7, edgecolor='black', label='Stones (>= 2mm)')
        
        ax1.axvline(np.mean(grain_sizes), color='red', linestyle='--', linewidth=2,
                    label=f'Mean: {np.mean(grain_sizes):.3f}mm')
        ax1.axvline(np.median(grain_sizes), color='blue', linestyle='--', linewidth=2,
                    label=f'Median: {np.median(grain_sizes):.3f}mm')

        # >>>>>>>>>>>>>>>> ADD COMPOSITE REPRESENTATIVE LINE <<<<<<<<<<<<<<<<
        if 'composite_representative_size' in getattr(self, 'last_stats', {}):
            comp_size = self.last_stats['composite_representative_size']
            ax1.axvline(comp_size, color='purple', linestyle='-', linewidth=3,
                        label=f'Composite Rep: {comp_size:.3f}mm')

        ax1.set_xlabel('Grain Size (mm)')
        ax1.set_ylabel('Count')
        ax1.set_title('Size Distribution (Sand & Stones)')
        ax1.legend()
        ax1.grid(True, alpha=0.3)
        
        # 2. Cumulative distribution
        sorted_sizes = np.sort(grain_sizes)
        cumulative = np.arange(1, len(sorted_sizes) + 1) / len(sorted_sizes) * 100
        ax2.plot(sorted_sizes, cumulative, 'b-', linewidth=3, label='All Particles')
        
        # Add separate lines for sand and stones if available
        if len(sand_sizes) > 0 and len(sand_sizes) > 1:
            sorted_sand = np.sort(sand_sizes)
            cumulative_sand = np.arange(1, len(sorted_sand) + 1) / len(sorted_sand) * 100
            ax2.plot(sorted_sand, cumulative_sand, 'g--', linewidth=2, label='Sand Only')
        
        if len(stone_sizes) > 0 and len(stone_sizes) > 1:
            sorted_stones = np.sort(stone_sizes)
            cumulative_stones = np.arange(1, len(sorted_stones) + 1) / len(sorted_stones) * 100
            ax2.plot(sorted_stones, cumulative_stones, 'c--', linewidth=2, label='Stones Only')
        
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
            labels.append('Sand')
            colors.append('lightgreen')
        
        if len(stone_sizes) > 0:
            data_to_plot.append(stone_sizes)
            labels.append('Stones')
            colors.append('lightblue')
        
        box = ax3.boxplot(data_to_plot, labels=labels, patch_artist=True)
        
        # Color the boxes
        for patch, color in zip(box['boxes'], colors):
            patch.set_facecolor(color)
            patch.set_alpha(0.7)
        
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
        plt.show()

    def process_single_image(self, image_path, min_grain_size=0.1, max_grain_size=2.0):
        """Process a single image for grain analysis"""
        print(f"Processing: {image_path}")
        print("="*60)
        
        # Load image
        img = cv2.imread(image_path)
        if img is None:
            print(f"Error: Could not load image {image_path}")
            return None, None
        
        print(f"Image loaded: {img.shape[1]}x{img.shape[0]} pixels")
        
        # Step 1: Detect coin for scale calibration
        print("\nStep 1: Coin Detection")
        if not self.detect_coin_accurate(img):
            print("Failed: Cannot proceed without proper coin detection")
            return None, None
        
        # Step 1b: Verify coin size
        print(f"\nStep 1b: Coin Size Verification")
        if not self.verify_coin_size(img):
            print("Coin size verification warning. Results may be inaccurate.")
            # Continue with warning rather than aborting
        
        # Step 2: Detect grains
        print(f"\nStep 2: Grain Detection")
        grain_sizes = self.detect_grains_improved(img, min_grain_size, max_grain_size)
        
        if not grain_sizes:
            print("No grains detected in the image")
            return None, None
        
        # Step 3: Statistical analysis
        print(f"\nStep 3: Statistical Analysis")
        stats, grain_array = self.analyze_grain_statistics(grain_sizes)
        
        if stats:
            # Store stats for plotting access
            self.last_stats = stats
            # Step 4: Create visualizations
            print(f"\nStep 4: Creating Visualizations")
            self.create_analysis_plots(grain_array)
        
        return stats, grain_array

# Simple usage function for sand and stone analysis
def analyze_sand_image(image_path, min_particle_mm=0.1, max_particle_mm=4.0):
    """Analyze sand image including both sand grains and small stones"""
    analyzer = AccurateGrainAnalyzer(known_coin_diameter_mm=20.0)  # Updated to match optimized size
    return analyzer.process_single_image(image_path, min_particle_mm, max_particle_mm)

# Main execution
if __name__ == "__main__":
    # Process single image - adjust path as needed
    image_path = "C:/Users/ragha/Downloads/WhatsApp Image 2025-09-21 at 13.24.50_30dc8b71.jpg"  # Change this to your image
    
    print("Starting Comprehensive Particle Size Analysis")
    print("(Including both sand grains and small stones)")
    print("=" * 60)
    
    stats, particle_data = analyze_sand_image(
        image_path, 
        min_particle_mm=0.1,  # Minimum particle size to detect 
        max_particle_mm=4.0   # Maximum particle size (includes small stones)
    )
    
    if stats:
        print(f"\n✅ Final Representative Particle Size: {stats['composite_representative_size']:.3f} mm")
        print(f"Total particles detected: {stats['count']}")
        
        # Print sand/stone breakdown if available
        if 'sand' in stats:
            print(f"Sand grains (< 2.0mm): {stats['sand']['count']}")
        if 'stones' in stats:
            print(f"Small stones (>= 2.0mm): {stats['stones']['count']}")
            
        print(f"\n🎉 Analysis complete!")
    else:
        print("\n❌ Analysis failed. Check coin visibility and image quality.")