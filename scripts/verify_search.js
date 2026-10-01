const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
  const { data: fuzzyData, error: fuzzyError } = await supabase.rpc("search_poems_fuzzy", {
    query_text: '静夜思',
    max_results: 5,
  });
  console.log("fuzzyData:", fuzzyData ? fuzzyData.map(d=>d.title+':'+d.author) : null, "Error:", fuzzyError);
}
verify();
