const fs = require('fs');

const path = 'src/workers/searchWorker.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Add fullPoems variable and background loader
const loaderCode = `
let fullPoems: any[] = [];

// Silently load full dataset in background
setTimeout(async () => {
    try {
        const fullResp = await fetch('/data/SUPER_DATASET_FULL.bin?v=full1');
        const fullBuf = await fullResp.arrayBuffer();
        const fullDecompressed = pako.inflate(fullBuf);
        const fullStr = new TextDecoder().decode(fullDecompressed);
        fullPoems = JSON.parse(fullStr);
        console.log("Full dataset loaded in background, size:", fullPoems.length);
    } catch (e) {
        console.error("Failed to load full dataset in background:", e);
    }
}, 3000);
`;
code = code.replace(/let poems: any\[\] = \[\];/, 'let poems: any[] = [];\n' + loaderCode);

// 2. Add handlers
const handlers = `
        if (type === 'ADD_CUSTOM') {
            const { customPoems } = e.data;
            if (customPoems && Array.isArray(customPoems)) {
                poems.push(...customPoems);
                console.log(\`Added \${customPoems.length} custom poems. Worker total: \${poems.length}\`);
            }
            self.postMessage({ id, status: 'ok' });
            return;
        }

        if (type === 'SEARCH_FULL') {
            const limitVal = limit || 50;
            const res = [];
            for (const p of fullPoems) {
                if (p.t.includes(query) || p.a.includes(query)) {
                    res.push({ ...p, id: generatePseudoId(p.t, p.a) });
                } else {
                    for (const line of p.content) {
                        if (line.includes(query)) {
                            res.push({ ...p, id: generatePseudoId(p.t, p.a), matchedLine: line });
                            break;
                        }
                    }
                }
                if (res.length >= limitVal) break;
            }
            self.postMessage({ type: 'SEARCH_FULL_RESULT', id, results: res });
            return;
        }
`;

code = code.replace(/if \(type === 'GET_POEM'\) {/, handlers + '\n        if (type === \'GET_POEM\') {');

fs.writeFileSync(path, code);
