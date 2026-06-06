#!/bin/bash

# PepsiCo Project Stop Script
# This script stops the backend and frontend servers

echo "🛑 Stopping PepsiCo Distributor Project..."
echo "=========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Stop backend
if [ -f "pepsico/logs/backend.pid" ]; then
    BACKEND_PID=$(cat pepsico/logs/backend.pid)
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo -e "${YELLOW}Stopping backend server (PID: $BACKEND_PID)...${NC}"
        kill $BACKEND_PID 2>/dev/null
        sleep 1
        # Force kill if still running
        if ps -p $BACKEND_PID > /dev/null 2>&1; then
            kill -9 $BACKEND_PID 2>/dev/null
        fi
        echo -e "${GREEN}✅ Backend server stopped${NC}"
    else
        echo -e "${YELLOW}⚠️  Backend server is not running${NC}"
    fi
    rm -f pepsico/logs/backend.pid
else
    echo -e "${YELLOW}⚠️  No backend PID file found${NC}"
fi

# Stop frontend
if [ -f "pepsico/logs/frontend.pid" ]; then
    FRONTEND_PID=$(cat pepsico/logs/frontend.pid)
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo -e "${YELLOW}Stopping frontend server (PID: $FRONTEND_PID)...${NC}"
        kill $FRONTEND_PID 2>/dev/null
        sleep 1
        # Force kill if still running
        if ps -p $FRONTEND_PID > /dev/null 2>&1; then
            kill -9 $FRONTEND_PID 2>/dev/null
        fi
        echo -e "${GREEN}✅ Frontend server stopped${NC}"
    else
        echo -e "${YELLOW}⚠️  Frontend server is not running${NC}"
    fi
    rm -f pepsico/logs/frontend.pid
else
    echo -e "${YELLOW}⚠️  No frontend PID file found${NC}"
fi

# Kill any remaining processes on ports 5001 and 5173
if lsof -Pi :5001 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${YELLOW}Cleaning up port 5001...${NC}"
    lsof -ti:5001 | xargs kill -9 2>/dev/null
fi

if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${YELLOW}Cleaning up port 5173...${NC}"
    lsof -ti:5173 | xargs kill -9 2>/dev/null
fi

echo ""
echo -e "${GREEN}✅ All servers stopped successfully${NC}"
echo ""
