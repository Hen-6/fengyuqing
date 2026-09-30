#!/bin/bash
export SUPABASE_URL="https://fpaaepzooyjeeevloiyb.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwYWFlcHpvb3lqZWVldmxvaXliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTc0MTU1OSwiZXhwIjoyMDk3MzE3NTU5fQ.wpVus4NXfxguHHSI44hA4FJ9wYuC4F7dfwp9Ip6Vx5Q"

echo "Starting massive dataset upload to $SUPABASE_URL..."
node scripts/upload_poems_supabase.js
echo "Upload complete!"
