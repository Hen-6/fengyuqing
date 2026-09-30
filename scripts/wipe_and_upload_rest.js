const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://fpaaepzooyjeeevloiyb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwYWFlcHpvb3lqZWVldmxvaXliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTc0MTU1OSwiZXhwIjoyMDk3MzE3NTU5fQ.wpVus4NXfxguHHSI44hA4FJ9wYuC4F7dfwp9Ip6Vx5Q';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("1. Wiping old poems via REST API...");
    const { error: delErr } = await supabase.from('poems').delete().neq('id', 'dummy');
    if (delErr) { console.error("Error wiping poems:", delErr); return; }
    console.log("Poems table is now completely empty.");

    console.log("2. Uploading 314,000 new poems...");
    // Let's spawn the actual upload script since it already does the chunking
    const { execSync } = require('child_process');
    try {
        execSync(`SUPABASE_URL="${supabaseUrl}" SUPABASE_SERVICE_ROLE_KEY="${supabaseKey}" node scripts/upload_poems_supabase.js`, { stdio: 'inherit' });
    } catch(e) {
        console.error("Upload failed.", e);
    }
}
run();
