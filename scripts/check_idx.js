const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://fpaaepzooyjeeevloiyb.supabase.co', process.env.SUPABASE_ANON_KEY);

async function test() {
  const start = Date.now();
  const { data, error } = await supabase.rpc('search_poems_body', { query_text: '床前明月光', max_results: 5 });
  console.log("Time taken:", Date.now() - start, "ms");
  console.log(data?.map(d=>d.title+':'+d.author) || error);
}
test();
