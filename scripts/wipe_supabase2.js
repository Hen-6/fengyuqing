const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
  const [key, val] = line.split('=');
  if (key && val) env[key.trim()] = val.trim();
});

const supabase = createClient(
  env['NEXT_PUBLIC_SUPABASE_URL'],
  env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
);

async function wipe() {
  const { data, error } = await supabase
    .from('user_progress')
    .delete()
    .neq('user_id', '00000000-0000-0000-0000-000000000000'); // Deletes all rows

  if (error) {
    console.error('Error wiping supabase:', error);
  } else {
    console.log('Supabase wipe complete.');
  }
}

wipe();
