#!/bin/bash

# Render build script for SandScore service
echo "Starting SandScore service build..."

# Install Python dependencies
cd SandScore
pip install -r requirements.txt

echo "Build completed successfully!"