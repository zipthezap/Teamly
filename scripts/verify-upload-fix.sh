#!/bin/bash

# Picture Upload Verification Script
# This script helps verify that the picture upload fix is working correctly

echo "=== Picture Upload Verification Script ==="
echo ""

# Check if we're in the project root
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo "✓ Project root directory found"
echo ""

# Check uploads directory structure
echo "Checking uploads directory structure..."
if [ -d "uploads/profiles" ] && [ -d "uploads/groups" ] && [ -d "uploads/temp" ]; then
    echo "✓ Uploads directory structure is correct"
else
    echo "❌ Uploads directory structure is missing"
    echo "   Creating directories..."
    mkdir -p uploads/profiles uploads/groups uploads/temp
    echo "✓ Directories created"
fi
echo ""

# Check frontend configuration
echo "Checking frontend configuration..."
if grep -q "port: 3001" src/frontend/vite.config.ts; then
    echo "✓ Frontend port is correctly set to 3001"
else
    echo "⚠️  Warning: Frontend port might not be set to 3001"
fi
echo ""

# Check backend port
echo "Checking backend configuration..."
if [ -f ".env" ]; then
    if grep -q "PORT=3000" .env; then
        echo "✓ Backend port is set to 3000"
    else
        echo "⚠️  Warning: Backend port might not be set to 3000"
    fi
else
    echo "⚠️  Warning: .env file not found. Please create one from .env.example"
    echo "   Expected backend PORT=3000"
fi
echo ""

# Check docker-compose
echo "Checking Docker configuration..."
if grep -q "uploads_data:/app/uploads" docker-compose.yml; then
    echo "✓ Docker volume mount for uploads is configured"
else
    echo "❌ Docker volume mount is missing in docker-compose.yml"
fi
echo ""

# Summary
echo "=== Verification Summary ==="
echo ""
echo "Development Mode Setup:"
echo "  1. Backend should run on: http://localhost:3000"
echo "  2. Frontend should run on: http://localhost:3001"
echo ""
echo "To start in development mode:"
echo "  Terminal 1: npm run dev (backend)"
echo "  Terminal 2: cd src/frontend && npm run dev (frontend)"
echo ""
echo "Docker Mode Setup:"
echo "  Backend: http://localhost:3000"
echo "  Frontend: http://localhost (port 80)"
echo ""
echo "To start with Docker:"
echo "  docker-compose up --build"
echo ""
echo "=== Next Steps ==="
echo "1. Make sure your .env file has PORT=3000 for backend"
echo "2. Create src/frontend/.env with VITE_API_URL=http://localhost:3000/api"
echo "3. Test uploading a profile or group picture"
echo "4. Verify the image displays correctly in the UI"
echo ""
