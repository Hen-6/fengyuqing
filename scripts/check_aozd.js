const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    "https://aozdppoypjlswuhfxzipi.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvemRwcG95cGpsd3VoZnh6aXBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NTMzODAsImV4cCI6MjA4NjIyOTM4MH0.2wdT6NKtZwjdPw7n9vV8zSW56Odes83SaeQ0dniHIqs"
);
async function run() {
    const { count, error } = await supabase.from('user_progress').select('*', { count: 'exact', head: true });
    console.log("Count:", count, "Error:", error ? error.message : null);
}
run();
