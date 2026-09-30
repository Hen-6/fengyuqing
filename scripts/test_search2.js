const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
    const { data, error } = await supabase.rpc('search_poems', { query_text: '飞花令', max_results: 10 });
    console.log("Data:", data ? data.length : 0, "Error:", error ? error.message : null);
}
run();
