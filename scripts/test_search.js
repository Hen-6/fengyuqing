const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
    const { data, error } = await supabase.rpc('search_poems_fuzzy', { query_text: '飞花令', max_results: 10 });
    console.log("Data:", data, "Error:", error ? error.message : null);
}
run();
