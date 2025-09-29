"""
Simple Grain Size Analysis Service
Built from scratch for reliability and simplicity
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import json
import os
import time
import requests
import tempfile
from datetime import datetime
from typing import Optional, Dict, Any
import traceback

# Import the grain analyzer
from hybrid_grain_analyzer import HybridGrainAnalyzer

app = FastAPI(title="Grain Analysis Service v2", version="2.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase configuration
SUPABASE_URL = "https://dbhklkalmabfbeevkrak.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiaGtsa2FsbWFiZmJlZXZrcmFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzNTczNjUsImV4cCI6MjA3MzkzMzM2NX0.qKwD7kwrJxqxzflLBBeOW4LKMn8AfFR71DW0EhnYHEI"

import traceback
from grain_size_analyzer import AccurateGrainAnalyzer

# Request/Response models
class AnalysisRequest(BaseModel):
    upload_id: str
    image_url: str

class AnalysisResponse(BaseModel):
    success: bool
    message: str
    analysis_id: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

class SimpleAnalysisService:
    def __init__(self, coin_diameter_mm=20.0):  # Optimized for Indian coins
        self.analyzer = HybridGrainAnalyzer(known_coin_diameter_mm=coin_diameter_mm)
        self.headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json"
        }
    
    def create_analysis_record(self, upload_id: str):
        """Create a simple analysis record"""
        try:
            data = {
                "upload_id": upload_id,
                "analysis_status": "processing",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            response = requests.post(
                f"{SUPABASE_URL}/rest/v1/grain_analysis",
                headers=self.headers,
                json=data
            )
            
            if response.status_code in [200, 201]:
                print(f"✅ Created analysis record for upload_id: {upload_id}")
                return response.json()
            else:
                print(f"❌ Failed to create analysis record: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Error creating analysis record: {e}")
            return None
    
    def update_analysis_status(self, upload_id: str, status: str, results: Dict = None, error: str = None):
        """Update analysis status using correct column names"""
        try:
            data = {
                "analysis_status": status,  # Use correct column name
                "updated_at": datetime.utcnow().isoformat()
            }
            
            if results:
                # Map to actual column names in the grain_analysis table
                # Based on the actual stats structure from grain analyzer
                data.update({
                    "total_particles": results.get("count", 0),
                    "valid_particles": results.get("valid_count", 0),
                    "rejected_particles": results.get("rejected_count", 0),
                    "sand_particles": results.get("sand", {}).get("count", 0),
                    "stone_particles": results.get("stones", {}).get("count", 0),
                    "mean_size": results.get("mean", 0.0),
                    "median_size": results.get("median", 0.0),
                    "std_deviation": results.get("std", 0.0),
                    "d10_size": results.get("d10", 0.0),
                    "d25_size": results.get("d25", 0.0),
                    "d50_size": results.get("d50", 0.0),
                    "d75_size": results.get("d75", 0.0),
                    "d90_size": results.get("d90", 0.0),
                    "sand_percentage": results.get("sand", {}).get("percentage", 0.0),
                    "stone_percentage": results.get("stones", {}).get("percentage", 0.0),
                    "processing_time_seconds": results.get("processing_time", 0.0),
                    "analysis_parameters": json.dumps(results)  # Store full results
                })
            
            if error:
                data["error_message"] = str(error)[:500]  # Limit error message length
            
            response = requests.patch(
                f"{SUPABASE_URL}/rest/v1/grain_analysis?upload_id=eq.{upload_id}",  # Use grain_analysis table
                headers=self.headers,
                json=data
            )
            
            if response.status_code in [200, 204]:
                print(f"✅ Updated analysis status to '{status}' for upload_id: {upload_id}")
                return True
            else:
                print(f"❌ Failed to update analysis status: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error updating analysis status: {e}")
            return False
    
    def analyze_image(self, upload_id: str, image_url: str):
        """Analyze image and save results"""
        start_time = time.time()
        
        try:
            print(f"🔍 Starting analysis for upload_id: {upload_id}")
            print(f"📷 Image URL: {image_url}")
            
            # Create analysis record
            self.create_analysis_record(upload_id)
            
            # Download image
            print("⬇️ Downloading image...")
            response = requests.get(image_url, timeout=30)
            response.raise_for_status()
            
            # Save to temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp_file:
                temp_file.write(response.content)
                temp_image_path = temp_file.name
            
            print(f"💾 Image saved to: {temp_image_path}")
            
            # Analyze image
            print("🔬 Running grain size analysis...")
            analysis_result = self.analyzer.process_single_image(temp_image_path)
            
            processing_time = time.time() - start_time
            
            print(f"🔍 Analysis result type: {type(analysis_result)}")
            print(f"🔍 Analysis result: {analysis_result}")
            
            # Handle the result properly - analyzer returns (stats, grain_array) or None
            if analysis_result is not None and isinstance(analysis_result, tuple) and len(analysis_result) >= 2:
                stats, grain_array = analysis_result
                
                if stats is not None and isinstance(stats, dict):
                    # Add processing time to results
                    stats["processing_time"] = processing_time
                    
                    print(f"✅ Analysis completed successfully in {processing_time:.2f}s")
                    print(f"📊 Stats: {stats}")
                    
                    # Update with success
                    self.update_analysis_status(upload_id, "completed", stats)
                    
                    return {
                        "success": True,
                        "message": "Analysis completed successfully",
                        "data": stats
                    }
                else:
                    error_msg = "Analysis returned invalid stats format"
                    print(f"❌ {error_msg}: {stats}")
            else:
                error_msg = "Analysis failed or returned invalid format"
                print(f"❌ {error_msg}: {analysis_result}")
            
            # If we get here, something went wrong
            self.update_analysis_status(upload_id, "failed", error=error_msg)
            
            return {
                "success": False,
                "message": error_msg
            }
                
        except Exception as e:
            error_msg = f"Analysis error: {str(e)}"
            self.update_analysis_status(upload_id, "failed", error=error_msg)
            
            print(f"❌ Analysis failed with exception: {e}")
            traceback.print_exc()
            
            return {
                "success": False,
                "message": error_msg
            }
        
        finally:
            # Clean up temp file
            try:
                if 'temp_image_path' in locals():
                    os.unlink(temp_image_path)
                    print(f"🗑️ Cleaned up temp file: {temp_image_path}")
            except:
                pass

# Initialize service with configurable coin diameter
analysis_service = SimpleAnalysisService(coin_diameter_mm=20.0)  # Start with 20mm

@app.get("/")
async def root():
    return {
        "message": "Hybrid Grain Analysis Service v2.0", 
        "status": "running", 
        "coin_diameter_mm": analysis_service.analyzer.coin_diameter_mm,
        "analyzer_type": "hybrid",
        "features": ["fast_numerical_data", "comprehensive_plots", "preprocessing_visualization"]
    }

@app.post("/configure")
async def configure_analyzer(coin_diameter_mm: float = 20.0):  # Optimized default
    """Configure the coin diameter for accurate measurements"""
    try:
        global analysis_service
        analysis_service = SimpleAnalysisService(coin_diameter_mm=coin_diameter_mm)
        return {
            "success": True, 
            "message": f"Hybrid analyzer configured with coin diameter: {coin_diameter_mm}mm",
            "coin_diameter_mm": coin_diameter_mm,
            "analyzer_type": "hybrid"
        }
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@app.get("/status/{upload_id}")
async def get_analysis_status(upload_id: str):
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/grain_analysis?upload_id=eq.{upload_id}",
            headers=analysis_service.headers
        )
        
        if response.status_code == 200:
            data = response.json()
            if data:
                return data[0]  # Return the first (and only) record
            else:
                raise HTTPException(status_code=404, detail="Analysis not found")
        else:
            raise HTTPException(status_code=500, detail="Database error")
            
    except Exception as e:
        print(f"❌ Error getting analysis status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analyses")
async def list_all_analyses():
    try:
        print("🔍 Getting analyses from grain_analysis table...")
        print(f"URL: {SUPABASE_URL}/rest/v1/grain_analysis")
        print(f"Headers: {analysis_service.headers}")
        
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/grain_analysis?order=created_at.desc&limit=10",
            headers=analysis_service.headers
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response text: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Found {len(data)} records")
            return {"analyses": data}
        else:
            print(f"Database error: {response.status_code} - {response.text}")
            raise HTTPException(status_code=500, detail=f"Database error: {response.status_code}")
            
    except Exception as e:
        error_msg = f"Error listing analyses: {str(e)}"
        print(f"❌ {error_msg}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=error_msg)

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_image(request: AnalysisRequest, background_tasks: BackgroundTasks):
    """Trigger image analysis"""
    try:
        print(f"\n🚀 New analysis request received:")
        print(f"   Upload ID: {request.upload_id}")
        print(f"   Image URL: {request.image_url}")
        
        # Run analysis in background
        background_tasks.add_task(
            analysis_service.analyze_image,
            request.upload_id,
            request.image_url
        )
        
        return AnalysisResponse(
            success=True,
            message="Analysis started successfully",
            analysis_id=request.upload_id
        )
        
    except Exception as e:
        print(f"❌ Error starting analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analysis/{upload_id}")
async def get_analysis(upload_id: str):
    """Get analysis results"""
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/image_analysis?upload_id=eq.{upload_id}&select=*",
            headers=analysis_service.headers
        )
        
        if response.status_code == 200:
            data = response.json()
            if data:
                return {"success": True, "data": data[0]}
            else:
                return {"success": False, "message": "Analysis not found"}
        else:
            return {"success": False, "message": f"Database error: {response.status_code}"}
            
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.get("/analyses")
async def get_all_analyses():
    """Get all analyses"""
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/image_analysis?select=*&order=created_at.desc",
            headers=analysis_service.headers
        )
        
        if response.status_code == 200:
            return {"success": True, "data": response.json()}
        else:
            return {"success": False, "message": f"Database error: {response.status_code}"}
            
    except Exception as e:
        return {"success": False, "message": str(e)}

if __name__ == "__main__":
    print("🚀 Starting Grain Analysis Service v2.0...")
    port = int(os.getenv("PORT", 8001))  # Use Render's PORT or default to 8001
    uvicorn.run(app, host="0.0.0.0", port=port, reload=False)