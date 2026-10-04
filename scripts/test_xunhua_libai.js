const fs = require('fs');
const zlib = require('zlib');
const unzipped = zlib.unzipSync(fs.readFileSync('public/data/SUPER_DATASET_DEDUPED.json.gz')).toString('utf8');
const poems = JSON.parse(unzipped).poems;

const p = poems.filter((x) => x.a === "李白" && x.t.includes("闻王昌龄"));
console.log("Found:", p);
