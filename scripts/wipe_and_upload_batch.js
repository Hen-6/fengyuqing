const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');

const supabaseUrl = 'https://fpaaepzooyjeeevloiyb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwYWFlcHpvb3lqZWVldmxvaXliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTc0MTU1OSwiZXhwIjoyMDk3MzE3NTU5fQ.wpVus4NXfxguHHSI44hA4FJ9wYuC4F7dfwp9Ip6Vx5Q';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("1. Wiping old poems in chunks to avoid timeout...");
    let deleted = 0;
    while (true) {
        const { data, error: fetchErr } = await supabase.from('poems').select('id').limit(5000);
        if (fetchErr) { console.error(fetchErr); break; }
        if (!data || data.length === 0) break;

        const ids = data.map(d => d.id);
        const { error: delErr } = await supabase.from('poems').delete().in('id', ids);
        if (delErr) { console.error("Error deleting:", delErr); break; }
        deleted += ids.length;
        console.log(`Deleted ${deleted} poems...`);
    }
    console.log("Poems table is now completely empty.");

    console.log("2. Uploading 314,000 new poems...");
    try {
        execSync(`SUPABASE_URL="${supabaseUrl}" SUPABASE_SERVICE_ROLE_KEY="${supabaseKey}" node scripts/upload_poems_supabase.js`, { stdio: 'inherit' });
    } catch(e) {
        console.error("Upload failed.", e);
    }
}
run();
