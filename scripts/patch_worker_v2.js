const fs = require('fs');
let content = fs.readFileSync('src/workers/searchWorker.ts', 'utf8');

content = content.replace(
    /SUPER_DATASET_DEDUPED\.bin\?v=\d+/g,
    'SUPER_DATASET_V2.bin?v=1'
);

content = content.replace(
    /SUPER_DATASET_DEDUPED\.json\.gz/g,
    'SUPER_DATASET_V2.bin'
);

// We should also map the new fields when returning results
const oldResultMap = `id: p.id, title: p.t, author: p.a, dynasty: p.d, lines: p.content, matchedLine: p.matchedLine, score: p.score`;
const newResultMap = `id: p.id, title: p.t, author: p.a, dynasty: p.d, lines: p.content, matchedLine: p.matchedLine, score: p.score, note: p.note, trans: p.trans, shangxi: p.shangxi, tags: p.tags`;

content = content.replace(new RegExp(oldResultMap.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'), 'g'), newResultMap);

fs.writeFileSync('src/workers/searchWorker.ts', content);
