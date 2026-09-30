const url = "https://fpaaepzooyjeeevloiyb.supabase.co/rest/v1/poems?limit=1";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvemRwcG95cGpsd3VoZnh6aXBpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDY1MzM4MCwiZXhwIjoyMDg2MjI5MzgwfQ.lw9K9-_gaxGNMbE-e_LpORJRI79nF4wPuilQktiJoks";

fetch(url, {
  headers: {
    "apikey": key,
    "Authorization": `Bearer ${key}`
  }
}).then(res => res.text()).then(console.log).catch(console.error);
