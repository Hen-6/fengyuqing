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

  const key = `${poem.name}:${poem.author}`;

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
    // 去重
    if (couplets.some(c => c.text === text)) continue;

    couplets.push({
      key,
      poemTitle: poem.name,
      poemAuthor: poem.author,
      text,
      cc: l1.length,
    });
  }
  return couplets;
}

async function getPoemByKeyExport(key) {
    const title = key.split(':')[0];
    const author = key.split(':')[1];
    const p = poems.find(x => x.t === title && x.a === author);
    if (!p) return null;
    return {
      poem: { _id: key, name: p.t, author: p.a, dynasty: p.d || "", content: p.content || [], note: "", matchedLine: p.content?.[0] || "", matchedLineIndex: 0 },
      score: 100,
    };
}

async function fetchNextCoupletAndGrid(keys) {
    const shuffled = [...keys];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    let pick = null;
    const BATCH_SIZE = 10;
    for (let i = 0; i < shuffled.length; i += BATCH_SIZE) {
      const batchKeys = shuffled.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batchKeys.map(k => getPoemByKeyExport(k)));
      
      const validCandidates = [];
      for (const res of batchResults) {
        if (!res || !res.poem) continue;
        const couplets = extractCouplets(res.poem);
        if (couplets.length > 0) {
          validCandidates.push(couplets[Math.floor(Math.random() * couplets.length)]);
        }
      }
      
      if (validCandidates.length > 0) {
        pick = validCandidates[Math.floor(Math.random() * validCandidates.length)];
        break;
      }
    }

    return pick;
}

const knownKeys = [
    "静夜思:李白",
    "登鹳雀楼:王之涣",
    "春晓:孟浩然",
    "江雪:柳宗元",
    "鹿柴:王维",
    "相思:王维",
    "悯农:李绅",
    "寻隐者不遇:贾岛"
];

fetchNextCoupletAndGrid(knownKeys).then(console.log);
