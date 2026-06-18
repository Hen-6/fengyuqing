const fs = require('fs');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');

// Read environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

// Create a Supabase client with the SERVICE ROLE key (bypasses RLS to write to the poems table)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  }
});

const POEMS_FILE = 'data/meilisearch_poems.json';
const BATCH_SIZE = 1000;

async function uploadPoems() {
  console.log('Starting upload to Supabase...');
  
  if (!fs.existsSync(POEMS_FILE)) {
    console.error(`Error: File ${POEMS_FILE} not found.`);
    process.exit(1);
  }

  const fileStream = fs.createReadStream(POEMS_FILE);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let batch = [];
  let totalUploaded = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
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
      console.error('Failed to parse line:', line, e);
    }
  }

  // Upload final batch
  if (batch.length > 0) {
    await uploadBatch(batch);
    totalUploaded += batch.length;
    console.log(`Uploaded ${totalUploaded} poems...`);
  }

  console.log('Upload completed successfully!');
}

async function uploadBatch(batch) {
  let retries = 3;
  while (retries > 0) {
    try {
      const { error } = await supabase
        .from('poems')
        .upsert(batch, { onConflict: 'key' });

      if (error) {
        throw error;
      }
      return;
    } catch (error) {
      retries--;
      console.error(`Batch upload failed. Retries remaining: ${retries}`, error.message);
      if (retries === 0) {
        console.error('Fatal: Batch upload failed after 3 attempts.');
        process.exit(1);
      }
      // Wait 1 second before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

uploadPoems();
