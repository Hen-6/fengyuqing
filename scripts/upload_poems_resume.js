const fs = require('fs');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const POEMS_FILE = 'data/meilisearch_poems.json';
const BATCH_SIZE = 1000;

async function run() {
    console.log("Fetching count of existing poems to resume...");
    const { count } = await supabase.from('poems').select('*', { count: 'exact', head: true });
    let skipCount = count || 0;
    console.log(`Skipping first ${skipCount} poems...`);

    const fileStream = fs.createReadStream(POEMS_FILE);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let batch = [];
    let currentLine = 0;
    let totalUploaded = skipCount;

    for await (const line of rl) {
        if (!line.trim()) continue;
        currentLine++;
        if (currentLine <= skipCount) continue;

        try {
            const p = JSON.parse(line);
            batch.push({
                id: p.id,
                key: `${p.title}:${p.author}`,
                title: p.title,
                author: p.author,
                dynasty: p.dynasty || '',
                lines: p.lines
            });

            if (batch.length >= BATCH_SIZE) {
                await uploadBatch(batch);
                totalUploaded += batch.length;
                console.log(`Uploaded ${totalUploaded} poems...`);
                batch = [];
            }
        } catch (e) {
            console.error('Failed to parse line:', e);
        }
    }

    if (batch.length > 0) {
        await uploadBatch(batch);
        totalUploaded += batch.length;
        console.log(`Uploaded ${totalUploaded} poems...`);
    }
    console.log('Upload fully completed!');
}

async function uploadBatch(batch) {
    let retries = 5;
    while (retries > 0) {
        try {
            const { error } = await supabase.from('poems').upsert(batch, { onConflict: 'key' });
            if (error) throw error;
            return;
        } catch (error) {
            retries--;
            console.error(`Batch failed. Retries left: ${retries}`, error.message);
            if (retries === 0) process.exit(1);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}

run();
