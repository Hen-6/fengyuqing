const fs = require('fs');
const zlib = require('zlib');
const unzipped = zlib.unzipSync(fs.readFileSync('public/data/SUPER_DATASET_DEDUPED.json.gz')).toString('utf8');
const poems = JSON.parse(unzipped).poems;

const oldKey = "将进酒·君不见黄河之水天上来:李白";
const title = oldKey.split(':')[0];
const author = oldKey.split(':')[1];

let p = poems.find((x) => x.t === title && x.a === author);

if (!p) {
    const cleanTitle = title.replace(/[·\s]/g, '');
    p = poems.find((x) => 
        x.a === author && 
        (x.t.replace(/[·\s]/g, '').includes(cleanTitle) || cleanTitle.includes(x.t.replace(/[·\s]/g, '')))
    );
}

if (p) {
    console.log("FOUND P:", p.t, p.a, p.content.length);
} else {
    console.log("NOT FOUND P");
}
