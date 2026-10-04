const fs = require('fs');
const zlib = require('zlib');
const unzipped = zlib.unzipSync(fs.readFileSync('public/data/SUPER_DATASET_DEDUPED.json.gz')).toString('utf8');
const poems = JSON.parse(unzipped).poems;

function strip(s) {
  return s.replace(/[，。！？、；：""''（）【】《》〈〉〔〕—…·.!?,\s]/g, "");
}

function extractCouplets(poem) {
  const couplets = [];
  const fullText = poem.content.join("");
  const textNoParens = fullText.replace(/[（(][^)）]*[)）]/g, "");
  const segments = textNoParens.split(/[。？！；]+/);

  for (const seg of segments) {
    const s = seg.trim();
    if (!s) continue;
    const parts = s.split(/[，、]/);
    if (parts.length !== 2) continue;
    const l1_raw = parts[0];
    const l2_raw = parts[1];
    const l1 = strip(l1_raw);
    const l2 = strip(l2_raw);
    
    if (l1.length !== l2.length) continue;
    if (l1.length !== 5 && l1.length !== 7) continue;

    const text = l1 + l2;
    if (couplets.some(c => c.text === text)) continue;

    couplets.push({ text });
  }
  return couplets;
}

const key = "赠别二首 一:杜牧";
const title = key.split(':')[0];
const author = key.split(':')[1];
const p = poems.find(x => x.t === title && x.a === author);
if (p) {
    console.log(key, "=>", extractCouplets({ name: p.t, author: p.a, content: p.content }));
} else {
    console.log(key, "=> NOT FOUND");
}
