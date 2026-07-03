#!/bin/bash

# Test Dashboard Blocking API

API="http://localhost:5001"
ADMIN_KEY="your-admin-key-here"

echo "Testing Dashboard Blocking API..."
echo "=================================="

# Test 1: Check blocking status
echo ""
echo "1️⃣ Checking blocking status..."
curl -s "$API/api/dashboard-blocking/dashboard-blocking" | jq . || echo "❌ Failed"

# Test 2: List access keys (requires admin key)
echo ""
echo "2️⃣ Listing access keys (requires admin key)..."
curl -s -H "x-admin-key: $ADMIN_KEY" "$API/api/dashboard-blocking/admin/access-keys" | jq . || echo "❌ Failed"

# Test 3: Check database tables exist
echo ""
echo "3️⃣ Checking database tables..."
echo "Note: You can verify tables in Supabase SQL Editor with this query:"
echo "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'dashboard%' OR table_name LIKE 'delivery_partner_access%';"

echo ""
echo "=================================="
echo "If tables exist, the database is initialized ✅"
echo "If not, run: node pepsico/database/run-dashboard-blocking-migration.js"
