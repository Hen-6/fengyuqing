const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
    const { error } = await supabase.from('user_progress').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
    console.log("Result:", error ? error.message : "Success! user_progress wiped.");
}
run();
