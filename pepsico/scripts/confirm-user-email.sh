#!/bin/bash

# Manual Email Confirmation Script
# Use this to manually confirm email for users who are stuck

API_BASE="http://localhost:5001"
ADMIN_KEY="Qk3uX9n7r2sP5w8yZa1cV4eB6mJ0tDs"

echo "🔧 Manual Email Confirmation Tool"
echo "================================="
echo ""

# Get all users
echo "📋 Fetching all users..."
USERS=$(curl -s -X GET "$API_BASE/api/admin/users" \
  -H "x-admin-key: $ADMIN_KEY")

echo "$USERS" | jq -r '.[] | "\(.email) - ID: \(.id)"'
echo ""

# Ask for user ID
echo "Enter the User ID to confirm:"
read USER_ID

if [ -z "$USER_ID" ]; then
  echo "❌ No user ID provided. Exiting."
  exit 1
fi

echo ""
echo "🔄 Confirming email for user: $USER_ID"

# Confirm the user's email
RESULT=$(curl -s -X POST "$API_BASE/api/admin/confirm-user-email" \
  -H "Content-Type: application/json" \
  -H "x-admin-key: $ADMIN_KEY" \
  -d "{\"userId\": \"$USER_ID\"}")

echo "$RESULT" | jq .

if echo "$RESULT" | grep -q "success"; then
  echo ""
  echo "✅ Email confirmed successfully!"
  echo "The user can now login."
else
  echo ""
  echo "❌ Failed to confirm email. Check the error above."
fi
