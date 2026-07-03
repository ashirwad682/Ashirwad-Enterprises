#!/bin/bash

# PepsiCo Project Startup Script
# This script checks for common issues and starts the backend and frontend servers

echo "🚀 PepsiCo Distributor Project - Startup Script"
echo "================================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Check if we're in the right directory
if [ ! -d "pepsico/backend" ] || [ ! -d "pepsico/frontend" ]; then
    echo -e "${RED}❌ Error: pepsico/backend or pepsico/frontend directory not found${NC}"
    echo "Please run this script from the project root directory"
    exit 1
fi

echo -e "${BLUE}📋 Checking environment setup...${NC}"
echo ""

# Step 2: Check backend .env file
if [ ! -f "pepsico/backend/.env" ]; then
    echo -e "${RED}❌ Error: pepsico/backend/.env file not found${NC}"
    echo "Please create pepsico/backend/.env with required environment variables"
    exit 1
else
    echo -e "${GREEN}✅ Backend .env file found${NC}"
fi

# Step 3: Check frontend .env file
if [ ! -f "pepsico/frontend/.env.local" ] && [ ! -f "pepsico/frontend/.env.development" ]; then
    echo -e "${RED}❌ Error: pepsico/frontend/.env file not found${NC}"
    echo "Please create pepsico/frontend/.env.local with required environment variables"
    exit 1
else
    echo -e "${GREEN}✅ Frontend .env file found${NC}"
fi

# Step 4: Check if node_modules exist
echo ""
echo -e "${BLUE}📦 Checking dependencies...${NC}"

if [ ! -d "pepsico/backend/node_modules" ]; then
    echo -e "${YELLOW}⚠️  Backend dependencies not installed${NC}"
    echo "Installing backend dependencies..."
    cd pepsico/backend && npm install && cd ../..
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to install backend dependencies${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Backend dependencies installed${NC}"
fi

if [ ! -d "pepsico/frontend/node_modules" ]; then
    echo -e "${YELLOW}⚠️  Frontend dependencies not installed${NC}"
    echo "Installing frontend dependencies..."
    cd pepsico/frontend && npm install && cd ../..
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to install frontend dependencies${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Frontend dependencies installed${NC}"
fi

# Step 5: Check if ports are available
echo ""
echo -e "${BLUE}🔍 Checking if ports are available...${NC}"

if lsof -Pi :5001 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${YELLOW}⚠️  Port 5001 is already in use${NC}"
    echo "Killing process on port 5001..."
    lsof -ti:5001 | xargs kill -9 2>/dev/null
fi

if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${YELLOW}⚠️  Port 5173 is already in use${NC}"
    echo "Killing process on port 5173..."
    lsof -ti:5173 | xargs kill -9 2>/dev/null
fi

echo -e "${GREEN}✅ Ports 5001 and 5173 are available${NC}"

# Step 6: Start the servers
echo ""
echo -e "${BLUE}🚀 Starting servers...${NC}"
echo ""


# Create log directory
mkdir -p pepsico/logs

# Start backend
echo -e "${GREEN}Starting backend server on port 5001...${NC}"
cd pepsico/backend
nohup npm start > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../logs/backend.pid
cd ../..

# Wait for backend to start
echo "Waiting for backend to start..."
sleep 3

# Check if backend is running
if ps -p $BACKEND_PID > /dev/null; then
    echo -e "${GREEN}✅ Backend server started (PID: $BACKEND_PID)${NC}"
else
    echo -e "${RED}❌ Backend server failed to start${NC}"
    echo "Check logs/backend.log for details"
    exit 1
fi

# Start frontend
echo -e "${GREEN}Starting frontend server on port 5173...${NC}"
cd pepsico/frontend
nohup npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../logs/frontend.pid
cd ../..

# Wait for frontend to start
echo "Waiting for frontend to start..."
sleep 3

# Check if frontend is running
if ps -p $FRONTEND_PID > /dev/null; then
    echo -e "${GREEN}✅ Frontend server started (PID: $FRONTEND_PID)${NC}"
else
    echo -e "${RED}❌ Frontend server failed to start${NC}"
    echo "Check logs/frontend.log for details"
    exit 1
fi

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}🎉 All servers are running!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "${BLUE}Backend:${NC}  http://localhost:5001"
echo -e "${BLUE}Frontend:${NC} http://localhost:5173"
echo ""
echo -e "${YELLOW}Logs:${NC}"
echo "  Backend:  logs/backend.log"
echo "  Frontend: logs/frontend.log"
echo ""
echo -e "${YELLOW}To stop the servers, run:${NC}"
echo "  ./stop-project.sh"
echo ""
echo -e "${YELLOW}To view logs in real-time:${NC}"
echo "  tail -f logs/backend.log"
echo "  tail -f logs/frontend.log"
echo ""
