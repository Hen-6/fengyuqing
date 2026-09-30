const url = "https://fpaaepzooyjeeevloiyb.supabase.co/rest/v1/poems?select=id&limit=1";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwYWFlcHpvb3lqZWVldmxvaXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NDE1NTksImV4cCI6MjA5NzMxNzU1OX0.YmU8Y4ioBmFjGryXJT6Q14LowRCsW1cbBXd-KQLJDvA";

fetch(url, {
  headers: {
    "apikey": key,
    "Authorization": `Bearer ${key}`
  }
}).then(res => res.text()).then(console.log).catch(console.error);
