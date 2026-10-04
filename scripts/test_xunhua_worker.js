const fs = require('fs');
const zlib = require('zlib');
const unzipped = zlib.unzipSync(fs.readFileSync('public/data/SUPER_DATASET_DEDUPED.json.gz')).toString('utf8');
const poems = JSON.parse(unzipped).poems;

const key = "静夜思:李白";
const title = key.split(':')[0];
const author = key.split(':')[1];
const p = poems.find((x) => x.t === title && x.a === author);
if (p) {
    console.log("FOUND P:", p.t, p.a, p.content.length);
} else {
    console.log("NOT FOUND P");
}
