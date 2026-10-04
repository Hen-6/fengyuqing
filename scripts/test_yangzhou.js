const fs = require('fs');
const zlib = require('zlib');
const unzipped = zlib.unzipSync(fs.readFileSync('public/data/SUPER_DATASET_DEDUPED.json.gz')).toString('utf8');
const poems = JSON.parse(unzipped).poems;

const matches = poems.filter(p => p.content.some(line => line.includes("春风十里扬州路")));
console.log(matches.slice(0, 2));
