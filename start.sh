#!/bin/bash

# Render start script for SandScore service
echo "Starting SandScore Analysis Service..."

cd SandScore
python -m uvicorn analysis_service:app --host 0.0.0.0 --port ${PORT:-8000}