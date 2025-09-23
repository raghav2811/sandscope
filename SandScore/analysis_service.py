from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import json
import os
import time
import traceback
from datetime import datetime
from typing import Optional, Dict, Any
import requests
import tempfile
from pathlib import Path

# Import the grain size analyzer
from grain_size_analyzer import AccurateGrainAnalyzer

app = FastAPI(title="Grain Size Analysis Service", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase configuration - should be loaded from environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://dbhklkalmabfbeevkrak.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiaGtsa2FsbWFiZmJlZXZrcmFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzNTczNjUsImV4cCI6MjA3MzkzMzM2NX0.qKwD7kwrJxqxzflLBBeOW4LKMn8AfFR71DW0EhnYHEI")

class AnalysisRequest(BaseModel):
    upload_id: str
    image_url: str
    min_particle_mm: float = 0.1
    max_particle_mm: float = 4.0

class AnalysisResponse(BaseModel):
    success: bool
    analysis_id: Optional[str] = None
    message: str
    data: Optional[Dict[str, Any]] = None

class AnalysisService:
    def __init__(self):
        self.analyzer = AccurateGrainAnalyzer(known_coin_diameter_mm=25.0)
    
    async def update_analysis_status(self, upload_id: str, status: str, error_message: str = None):
        """Update analysis status in Supabase"""
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json"
        }
        
        update_data = {
            "analysis_status": status,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        if error_message:
            update_data["error_message"] = error_message
            
        try:
            response = requests.patch(
                f"{SUPABASE_URL}/rest/v1/grain_analysis?upload_id=eq.{upload_id}",
                headers=headers,
                json=update_data
            )
            response.raise_for_status()
        except Exception as e:
            print(f"Failed to update analysis status: {e}")
            # Don't raise here to avoid breaking the flow
    
    async def save_analysis_results(self, upload_id: str, analysis_data: Dict[str, Any]):
        """Save analysis results to Supabase"""
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json"
        }
        
        # Prepare the data for database insertion
        db_data = {
            "upload_id": upload_id,
            "analysis_status": "completed",
            "total_particles": analysis_data.get("count", 0),
            "valid_particles": analysis_data.get("valid_count", 0),
            "rejected_particles": analysis_data.get("rejected_count", 0),
            "sand_particles": analysis_data.get("sand", {}).get("count", 0),
            "stone_particles": analysis_data.get("stones", {}).get("count", 0),
            "mean_size": analysis_data.get("mean", 0),
            "median_size": analysis_data.get("median", 0),
            "std_deviation": analysis_data.get("std", 0),
            "representative_size": analysis_data.get("composite_representative_size", 0),
            "d10_size": analysis_data.get("d10", 0),
            "d25_size": analysis_data.get("d25", 0),
            "d50_size": analysis_data.get("d50", 0),
            "d75_size": analysis_data.get("d75", 0),
            "d90_size": analysis_data.get("d90", 0),
            "sand_percentage": analysis_data.get("sand", {}).get("percentage", 0),
            "stone_percentage": analysis_data.get("stones", {}).get("percentage", 0),
            "coin_detected": analysis_data.get("coin_detected", False),
            "coin_diameter_px": analysis_data.get("coin_diameter_px", 0),
            "pixels_per_mm": analysis_data.get("pixels_per_mm", 0),
            "processing_time_seconds": analysis_data.get("processing_time", 0),
            "particle_sizes": json.dumps(analysis_data.get("all_sizes", [])),
            "rejection_reasons": json.dumps(analysis_data.get("rejection_breakdown", {})),
            "analysis_parameters": json.dumps(analysis_data.get("parameters", {})),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        try:
            # First, try to update existing record
            print(f"Attempting to update analysis for upload_id: {upload_id}")
            print(f"URL: {SUPABASE_URL}/rest/v1/grain_analysis?upload_id=eq.{upload_id}")
            print(f"Data keys: {list(db_data.keys())}")
            
            response = requests.patch(
                f"{SUPABASE_URL}/rest/v1/grain_analysis?upload_id=eq.{upload_id}",
                headers=headers,
                json=db_data
            )
            
            print(f"PATCH response status: {response.status_code}")
            print(f"PATCH response text: {response.text[:500]}")
            
            if response.status_code == 404 or not response.json():
                # If no existing record, create new one
                print(f"Creating new analysis record for upload_id: {upload_id}")
                response = requests.post(
                    f"{SUPABASE_URL}/rest/v1/grain_analysis",
                    headers=headers,
                    json=db_data
                )
                print(f"POST response status: {response.status_code}")
                print(f"POST response text: {response.text[:500]}")
            
            response.raise_for_status()
            return response.json()
            
        except Exception as e:
            print(f"Failed to save analysis results: {e}")
            print(f"Exception type: {type(e)}")
            print(f"Supabase URL: {SUPABASE_URL}")
            print(f"Headers: {headers}")
            print(f"Response status: {getattr(response, 'status_code', 'N/A')}")
            print(f"Response text: {getattr(response, 'text', 'N/A')}")
            traceback.print_exc()
            raise e
    
    async def process_image(self, upload_id: str, image_url: str, min_particle_mm: float, max_particle_mm: float):
        """Process image and analyze grain size"""
        start_time = time.time()
        
        try:
            # Update status to processing
            await self.update_analysis_status(upload_id, "processing")
            
            # Download image to temporary file
            response = requests.get(image_url)
            response.raise_for_status()
            
            with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_file:
                tmp_file.write(response.content)
                temp_image_path = tmp_file.name
            
            try:
                # Run analysis
                stats, grain_array = self.analyzer.process_single_image(
                    temp_image_path, 
                    min_particle_mm, 
                    max_particle_mm
                )
                
                processing_time = time.time() - start_time
                
                if stats:
                    # Add processing metadata
                    stats["processing_time"] = processing_time
                    stats["parameters"] = {
                        "min_particle_mm": min_particle_mm,
                        "max_particle_mm": max_particle_mm,
                        "known_coin_diameter_mm": self.analyzer.known_coin_diameter_mm
                    }
                    
                    # Save results to database
                    await self.save_analysis_results(upload_id, stats)
                    
                    return {
                        "success": True,
                        "data": stats,
                        "processing_time": processing_time
                    }
                else:
                    await self.update_analysis_status(upload_id, "failed", "No grains detected or analysis failed")
                    return {
                        "success": False,
                        "error": "No grains detected or analysis failed"
                    }
                    
            finally:
                # Clean up temporary file
                os.unlink(temp_image_path)
                
        except Exception as e:
            error_msg = f"Analysis failed: {str(e)}"
            await self.update_analysis_status(upload_id, "failed", error_msg)
            raise HTTPException(status_code=500, detail=error_msg)

# Initialize service
analysis_service = AnalysisService()

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_image(request: AnalysisRequest, background_tasks: BackgroundTasks):
    """Analyze grain size for uploaded image"""
    try:
        # Add background task for processing
        background_tasks.add_task(
            analysis_service.process_image,
            request.upload_id,
            request.image_url,
            request.min_particle_mm,
            request.max_particle_mm
        )
        
        return AnalysisResponse(
            success=True,
            message="Analysis started",
            analysis_id=request.upload_id
        )
        
    except Exception as e:
        return AnalysisResponse(
            success=False,
            message=f"Failed to start analysis: {str(e)}"
        )

@app.get("/analysis/{upload_id}")
async def get_analysis_results(upload_id: str):
    """Get analysis results for an upload"""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/grain_analysis?upload_id=eq.{upload_id}",
            headers=headers
        )
        response.raise_for_status()
        
        results = response.json()
        if results:
            return {"success": True, "data": results[0]}
        else:
            return {"success": False, "message": "Analysis not found"}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve analysis: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "grain-analysis", "version": "1.0.0"}

@app.post("/analyze/{upload_id}")
async def retry_analysis(upload_id: str, background_tasks: BackgroundTasks):
    """Retry analysis for a specific upload"""
    try:
        # Get upload info from database
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json"
        }
        
        # Get upload details
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/uploads?id=eq.{upload_id}",
            headers=headers
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=404, detail="Upload not found")
            
        uploads = response.json()
        if not uploads:
            raise HTTPException(status_code=404, detail="Upload not found")
            
        upload = uploads[0]
        image_url = upload['file_url']
        
        # Reset status to pending and trigger analysis
        await analysis_service.update_analysis_status(upload_id, "pending")
        
        # Add background task for processing
        background_tasks.add_task(
            analysis_service.process_image,
            upload_id,
            image_url,
            0.1,  # min_particle_mm
            4.0   # max_particle_mm
        )
        
        return AnalysisResponse(
            success=True,
            message="Analysis retry started",
            analysis_id=upload_id
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retry analysis: {str(e)}")

@app.get("/analyses")
async def get_all_analyses():
    """Get all analyses for debugging"""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/grain_analysis?select=*,uploads(file_name,file_url,uploaded_at)",
            headers=headers
        )
        
        if response.status_code == 200:
            return {"success": True, "data": response.json()}
        else:
            return {"success": False, "error": f"Database error: {response.status_code}"}
            
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("analysis_service:app", host="0.0.0.0", port=8000, reload=True)