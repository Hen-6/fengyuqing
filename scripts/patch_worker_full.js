const fs = require('fs');

const path = 'src/workers/searchWorker.ts';
let code = fs.readFileSync(path, 'utf8');

// We need to add full dataset loading and searching.
const injection = `
let fullDataset: any[] = [];
let isFullLoading = false;
let fullLoadPromise: Promise<void> | null = null;

async function loadFullDataset() {
    if (fullDataset.length > 0) return;
    if (isFullLoading && fullLoadPromise) return fullLoadPromise;
    
    isFullLoading = true;
    fullLoadPromise = (async () => {
        try {
            console.log("[Worker] Fetching SUPER_DATASET_FULL.bin...");
            const res = await fetch('/data/SUPER_DATASET_FULL.bin?v=1');
            if (!res.ok) throw new Error("Failed to fetch full dataset");
            const arrayBuffer = await res.arrayBuffer();
            
            // Inflate
            const uint8Array = new Uint8Array(arrayBuffer);
            const decompressed = pako.inflate(uint8Array, { to: 'string' });
            
            const parsed = JSON.parse(decompressed);
            fullDataset = parsed.poems;
            console.log("[Worker] Full dataset loaded, items:", fullDataset.length);
        } catch (e) {
            console.error("[Worker] Failed to load full dataset:", e);
        } finally {
            isFullLoading = false;
        }
    })();
    return fullLoadPromise;
}

// Background idle load for full dataset
setTimeout(() => {
    loadFullDataset().catch(() => {});
}, 3000);
`;

code = code.replace(/let dataset.*?;/s, match => injection + '\n' + match);

// Also handle SEARCH_FULL
const caseFull = `
        case 'SEARCH_FULL':
            if (fullDataset.length === 0) {
                await loadFullDataset();
            }
            // Execute the same fuzzy/pinyin search but over fullDataset
            let fRes = [];
            let fQuery = data.query || "";
            let fLimit = data.limit || 50;
            
            // Simple exact/fuzzy search for full dataset to keep it fast
            for (let i = 0; i < fullDataset.length; i++) {
                const p = fullDataset[i];
                if (p.t.includes(fQuery) || p.a.includes(fQuery) || p.content.some((l: string) => l.includes(fQuery))) {
                    fRes.push(p);
                    if (fRes.length >= fLimit) break;
                }
            }
            self.postMessage({ type: 'SEARCH_FULL_RESULT', results: fRes, id: data.id });
            break;

        case 'ADD_CUSTOM':
            const customPoems = data.poems || [];
            for (const cp of customPoems) {
                // Prepend to small dataset so it has priority
                const idx = dataset.findIndex(p => p.t === cp.t && p.a === cp.a);
                if (idx !== -1) {
                    dataset[idx] = cp;
                } else {
                    dataset.unshift(cp);
                }
            }
            self.postMessage({ type: 'ADD_CUSTOM_RESULT', id: data.id });
            break;
`;

code = code.replace(/case 'GET_POEM':/s, match => caseFull + '\n        ' + match);

fs.writeFileSync(path, code);
