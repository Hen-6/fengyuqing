const fs = require('fs');
const zlib = require('zlib');
const data = fs.readFileSync('public/data/SUPER_DATASET_DEDUPED.bin');
let jsonStr = zlib.inflateSync(data).toString();
const poems = JSON.parse(jsonStr).poems;

function strip(s) {
  return s.replace(/[^\u4e00-\u9fa5]/g, "");
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

    couplets.push({
      l1, l2, text
    });
  }
  return couplets;
}

const jy = poems.find(x => x.t === "静夜思" && x.a === "李白");
console.log("静夜思 couplets:", extractCouplets({ name: jy.t, author: jy.a, content: jy.content }));
