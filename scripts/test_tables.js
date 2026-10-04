const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n');
const supabaseUrl = env.find(l => l.startsWith('NEXT_PUBLIC_SUPABASE_URL')).split('=')[1];
const supabaseKey = env.find(l => l.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY')).split('=')[1];
const supabase = createClient(supabaseUrl, supabaseKey);
async function test() {
    const { data, error } = await supabase.from('user_settings').select('*').limit(1);
    console.log("Data:", data, "Error:", error);
}
test();
