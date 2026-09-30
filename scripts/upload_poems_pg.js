const { Client } = require('pg');
const fs = require('fs');
const readline = require('readline');

const DB_URL = "postgresql://postgres:20070529_Henry!@db.fpaaepzooyjeeevloiyb.supabase.co:6543/postgres";
const POEMS_FILE = 'data/meilisearch_poems.json';
const BATCH_SIZE = 5000;

async function run() {
    console.log("Connecting directly to PostgreSQL (bypassing REST API timeouts)...");
    const client = new Client({ connectionString: DB_URL });
    await client.connect();

    console.log("Emptying the poems table cleanly...");
    await client.query("TRUNCATE TABLE poems;");

    console.log("Uploading poems in massive chunks...");
    const fileStream = fs.createReadStream(POEMS_FILE);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let batch = [];
    let totalUploaded = 0;

    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const p = JSON.parse(line);
            batch.push([
                p.id, 
                `${p.title}:${p.author}`, 
                p.title, 
                p.author, 
                p.dynasty || '', 
                `{${p.lines.map(l => `"${l.replace(/"/g, '""')}"`).join(',')}}`
            ]);

            if (batch.length >= BATCH_SIZE) {
                await insertBatch(client, batch);
                totalUploaded += batch.length;
                console.log(`Uploaded ${totalUploaded} poems...`);
                batch = [];
            }
        } catch (e) {
            console.error('Failed to parse line:', e);
        }
    }

    if (batch.length > 0) {
        await insertBatch(client, batch);
        totalUploaded += batch.length;
        console.log(`Uploaded ${totalUploaded} poems...`);
    }

    console.log('Upload fully completed!');
    await client.end();
}

async function insertBatch(client, batch) {
    const values = [];
    const flatBatch = [];
    let index = 1;

    for (const row of batch) {
        values.push(`($${index++}, $${index++}, $${index++}, $${index++}, $${index++}, $${index++})`);
        flatBatch.push(...row);
    }

    const query = `
        INSERT INTO poems (id, key, title, author, dynasty, lines)
        VALUES ${values.join(',')}
        ON CONFLICT (key) DO NOTHING;
    `;
    
    await client.query(query, flatBatch);
}

run().catch(console.error);
