#!/bin/bash

# Coupon & Offer Usage Tracking - Quick Setup Script
# Run this after executing the database migration

echo "=================================================="
echo "  Discount Usage Tracking - Quick Setup"
echo "=================================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this from the pepsico project root"
    exit 1
fi

echo "✅ Step 1: Database Migration"
echo "   Please run the following in Supabase SQL Editor:"
echo "   File: database/ADD_OFFER_USAGE_TABLE.sql"
echo ""
read -p "   Have you run the migration? (y/n): " migration_done

if [ "$migration_done" != "y" ]; then
    echo "❌ Please run the migration first, then run this script again"
    exit 1
fi

echo ""
echo "✅ Step 2: Restarting Backend Server"
cd backend
if [ -f "server.js" ]; then
    echo "   Killing any existing backend processes..."
    pkill -f "node.*server.js" 2>/dev/null || true
    sleep 2
    
    echo "   Starting backend server..."
    npm run dev &
    BACKEND_PID=$!
    echo "   Backend started with PID: $BACKEND_PID"
else
    echo "❌ server.js not found in backend directory"
    exit 1
fi

cd ..

echo ""
echo "✅ Step 3: Starting Frontend"
cd frontend
if [ -f "package.json" ]; then
    echo "   Starting frontend development server..."
    npm run dev &
    FRONTEND_PID=$!
    echo "   Frontend started with PID: $FRONTEND_PID"
else
    echo "❌ package.json not found in frontend directory"
    exit 1
fi

cd ..

echo ""
echo "=================================================="
echo "  Setup Complete! 🎉"
echo "=================================================="
echo ""
echo "Services Running:"
echo "  • Backend:  http://localhost:5001"
echo "  • Frontend: http://localhost:5173"
echo ""
echo "To Test:"
echo "  1. Login as a user"
echo "  2. Add products to cart"
echo "  3. Apply a coupon (e.g., SAVE10)"
echo "  4. Complete the order"
echo "  5. Try to use the same coupon again"
echo "     → Should see: 'Already used' message"
echo ""
echo "  6. Add products that qualify for an offer"
echo "  7. Complete the order with auto-offer"
echo "  8. Try to add the same products again"
echo "     → Previously used offer should NOT appear"
echo ""
echo "Documentation: DISCOUNT_USAGE_TRACKING.md"
echo ""
echo "To stop servers:"
echo "  kill $BACKEND_PID $FRONTEND_PID"
echo ""
