const { Client } = require('pg');
const dns = require('dns');
dns.setDefaultResultOrder('ipv6first'); // Force IPv6 for Supabase direct connections

const DB_URL = "postgresql://postgres:20070529_Henry!@db.fpaaepzooyjeeevloiyb.supabase.co:5432/postgres";

async function run() {
    console.log("Connecting directly to PostgreSQL (IPv6)...");
    const client = new Client({ connectionString: DB_URL });
    await client.connect();

    try {
        console.log("2. Building Trigram Index on 314k poems... (This may take 1-3 minutes)");
        await client.query(`
            CREATE INDEX IF NOT EXISTS poems_lines_trgm_idx 
            ON poems USING gin (array_to_string_immutable(lines) gin_trgm_ops);
        `);
        console.log("Index built successfully!");
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.end();
    }
}
run();
