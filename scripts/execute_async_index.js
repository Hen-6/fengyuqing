async function test() {
    const url = 'https://fpaaepzooyjeeevloiyb.supabase.co/rest/v1/rpc/build_trigram_index';
    const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwYWFlcHpvb3lqZWVldmxvaXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NDE1NTksImV4cCI6MjA5NzMxNzU1OX0.YmU8Y4ioBmFjGryXJT6Q14LowRCsW1cbBXd-KQLJDvA';
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'apikey': key,
            'Authorization': 'Bearer ' + key,
            'Prefer': 'respond-async'
        }
    });
    console.log("Status:", res.status);
    console.log("Body:", await res.text());
}
test();
