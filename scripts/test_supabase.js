const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
    const [k, ...v] = line.split('=');
    if (k) acc[k.trim()] = v.join('=').trim().replace(/"/g, '');
    return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
    const { data, error, count } = await supabase
        .from('poems')
        .select('*', { count: 'exact', head: true });
    
    console.log("Supabase poems count:", count);

    // Try finding "落花人独立"
    const { data: d2 } = await supabase
        .from('poems')
        .select('title, author, content')
        .like('content', '%落花人独立%')
        .limit(5);
    console.log("LIKE search matches:", d2?.map(p => p.title));
}
test();
