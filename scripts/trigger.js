async function test() {
    const url = 'https://fpaaepzooyjeeevloiyb.supabase.co/rest/v1/rpc/build_trigram_index';
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'apikey': process.env.SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + process.env.SUPABASE_ANON_KEY,
            'Prefer': 'respond-async'
        }
    });
    console.log("Status:", res.status);
    console.log("Body:", await res.text());
}
test();
