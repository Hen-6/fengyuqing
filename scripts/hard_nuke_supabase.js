const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8').split('\n');
const supabaseUrl = env.find(l => l.startsWith('NEXT_PUBLIC_SUPABASE_URL')).split('=')[1].trim();
// We need service role key to delete without RLS issues, but if RLS allows delete for anon users based on user_id, we can just delete everything.
// Wait, we don't know the user's ID in the Node script.
// Let's inject a frontend script that nukes BOTH localStorage AND Supabase instantly on load.
