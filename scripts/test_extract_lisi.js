const fs = require('fs');
const zlib = require('zlib');
const data = fs.readFileSync('public/data/SUPER_DATASET_DEDUPED.bin');
let jsonStr = zlib.inflateSync(data).toString();
const poems = JSON.parse(jsonStr).poems;

function strip(s) { return s.replace(/[^\u4e00-\u9fa5]/g, ""); }
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
    const l1 = strip(parts[0]);
    const l2 = strip(parts[1]);
    if (l1.length !== l2.length || (l1.length !== 5 && l1.length !== 7)) continue;
    couplets.push(l1 + l2);
  }
  return couplets;
}

const p = poems.find(x => x.t.includes('离思五首') && x.a === '元稹');
console.log("Poem:", p.t);
console.log("Lines:", p.content);
console.log("Couplets:", extractCouplets({ name: p.t, author: p.a, content: p.content }));
