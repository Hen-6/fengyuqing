const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
    const { error } = await supabase.from('user_progress').delete().gte('level', 0);
    console.log("Result:", error ? error.message : "Success!");
    const { count } = await supabase.from('user_progress').select('*', { count: 'exact', head: true });
    console.log("New Count:", count);
}
run();
