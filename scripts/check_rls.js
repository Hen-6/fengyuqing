const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
    const { data: policies } = await supabase.from('pg_policies').select('*').eq('tablename', 'user_progress');
    console.log("Policies:", policies);
}
run();
