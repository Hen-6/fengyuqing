import { supabase } from '../src/lib/supabaseClient';
async function test() {
    console.time("DB Query");
    const { data } = await supabase.from('poems').select('id, title, author').like('id', '42982cd2dcb4%');
    console.timeEnd("DB Query");
    console.log(data);
}
test();
