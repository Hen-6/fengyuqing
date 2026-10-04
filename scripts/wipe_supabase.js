const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
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
