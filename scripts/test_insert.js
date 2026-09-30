const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
    console.log("Testing a single insert...");
    const { error } = await supabase.from('poems').insert([{ id: 'test_lock', key: 'test:lock', title: 'test', author: 'test', lines: [] }]);
    console.log("Result:", error ? error.message : "Success!");
}
run();
