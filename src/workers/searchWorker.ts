import * as pako from 'pako';

let globalPoemsCache: any[] | null = null;
let isLoading = false;
let loadPromise: Promise<void> | null = null;

function levenshtein(s: string, t: string) {
    if (!s.length) return t.length;
    if (!t.length) return s.length;
    const arr: number[][] = [];
    for (let i = 0; i <= t.length; i++) {
        arr[i] = [i];
        for (let j = 1; j <= s.length; j++) {
            arr[i][j] = i === 0 ? j : Math.min(
                arr[i - 1][j] + 1,
                arr[i][j - 1] + 1,
                arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1)
            );
        }
    }
    return arr[t.length][s.length];
}

function sharesEnoughChars(line: string, query: string): boolean {
    let matchCount = 0;
    for (let i = 0; i < query.length; i++) {
        if (line.includes(query[i])) {
            matchCount++;
        }
    }
    return matchCount >= Math.floor(query.length / 2);
}

function generatePseudoId(t: string, a: string) {
    let hash = 0;
    const str = t + ':' + a;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(12, '0');
}

async function loadDataset() {
    if (globalPoemsCache) return;
    if (loadPromise) return loadPromise;

    isLoading = true;
    loadPromise = (async () => {
        try {
            console.log("[Worker] Fetching SUPER_DATASET_DEDUPED.bin...");
            const res = await fetch('/data/SUPER_DATASET_DEDUPED.bin?v=5');
            if (!res.ok) throw new Error("Failed to fetch dataset");
            const arrayBuffer = await res.arrayBuffer();
            
            console.log(`[Worker] Fetched ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB. Decompressing...`);
            const decompressedArray = pako.inflate(new Uint8Array(arrayBuffer));
            const decompressed = new TextDecoder().decode(decompressedArray);
            
            console.log("[Worker] Parsing JSON...");
            globalPoemsCache = JSON.parse(decompressed).poems;
            console.log(`[Worker] Loaded ${globalPoemsCache!.length} poems.`);
        } catch (e) {
            console.error("[Worker] Load error:", e);
        } finally {
            isLoading = false;
        }
    })();

    return loadPromise;
}

self.addEventListener('message', async (e) => {
    const { id, type, query, mode, limit, key } = e.data;
    
    if (type === 'PING') {
        self.postMessage({ id, status: 'PONG' });
        return;
    }

    try {
        await loadDataset();
        if (!globalPoemsCache) {
            self.postMessage({ id, error: 'Dataset not loaded' });
            return;
        }
        
        const poems = globalPoemsCache;

        // GET SINGLE POEM BY KEY (For progress page / details)
        if (type === 'GET_POEM') {
            const title = key.split(':')[0];
            const author = key.split(':')[1];
            let p = poems.find((x: any) => x.t === title && x.a === author);
            
            // Fallback for old dataset keys (e.g. '赠别·其一' vs '赠别二首 一')
            if (!p) {
                const cleanTitle = title.replace(/[·\s]/g, '');
                p = poems.find((x: any) => 
                    x.a === author && 
                    (x.t.replace(/[·\s]/g, '').includes(cleanTitle) || cleanTitle.includes(x.t.replace(/[·\s]/g, '')))
                );
            }

            self.postMessage({ id, results: p ? { poem: { ...p, id: generatePseudoId(p.t, p.a) } } : { poem: null } });
            return;
        }

        // SEARCH ROUTE
        if (type === 'SEARCH') {
            const exactLimit = limit || (mode === 'char' ? 200 : 5);
            const fuzzyLimit = 5;
            
            let exactMatches: any[] = [];
            let roughMatches: any[] = [];

            if (mode === 'char') {
                const matchType = e.data.matchType || 'exact';
                const chars = matchType === 'scattered' ? Array.from(query) : [];
                
                for (const p of poems) {
                    for (const line of p.content) {
                        let matched = false;
                        if (matchType === 'scattered') {
                            matched = chars.every(c => line.includes(c));
                        } else {
                            matched = line.includes(query);
                        }

                        if (matched) {
                            exactMatches.push({ ...p, id: generatePseudoId(p.t, p.a), score: 100, matchedLine: line });
                            break;
                        }
                    }
                    if (exactMatches.length >= exactLimit) break;
                }
                self.postMessage({ id, results: exactMatches.map(p => ({
                    id: p.id, title: p.t, author: p.a, dynasty: p.d, lines: p.content, matchedLine: p.matchedLine, score: p.score, note: p.note, trans: p.trans, shangxi: p.shangxi, tags: p.tags
                })) });
                return;
            }
            
            if (mode === 'line') {
                for (const p of poems) {
                    for (const line of p.content) {
                        if (line.includes(query)) {
                            exactMatches.push({ ...p, id: generatePseudoId(p.t, p.a), matchedLine: line, score: 100 });
                            break;
                        }
                    }
                }

                if (exactMatches.length > 0) {
                    const finalExact = exactMatches.sort((a, b) => b.score - a.score).slice(0, exactLimit);
                    self.postMessage({ id, results: finalExact.map(p => ({
                        id: p.id, title: p.t, author: p.a, dynasty: p.d, lines: p.content, matchedLine: p.matchedLine, score: p.score, note: p.note, trans: p.trans, shangxi: p.shangxi, tags: p.tags
                    })) });
                    return;
                }

                for (const p of poems) {
                    let bestDist = 999;
                    let bestLine = "";
                    for (const line of p.content) {
                        if (!sharesEnoughChars(line, query)) continue;
                        
                        if (Math.abs(line.length - query.length) < 5) {
                            const dist = levenshtein(line.replace(/[^\u4e00-\u9fa5]/g, ""), query.replace(/[^\u4e00-\u9fa5]/g, ""));
                            if (dist < bestDist) { bestDist = dist; bestLine = line; }
                        } else {
                            const cleanLineForSub = line.replace(/[^\u4e00-\u9fa5]/g, "");
                            const cleanQueryForSub = query.replace(/[^\u4e00-\u9fa5]/g, "");
                            for (let i = 0; i <= cleanLineForSub.length - cleanQueryForSub.length; i++) {
                                const sub = cleanLineForSub.substring(i, i + cleanQueryForSub.length);
                                const dist = levenshtein(sub, cleanQueryForSub);
                                if (dist < bestDist) { bestDist = dist; bestLine = line; }
                            }
                        }
                    }
                    if (bestDist <= 2) { 
                        roughMatches.push({ ...p, id: generatePseudoId(p.t, p.a), matchedLine: bestLine, score: 50 - bestDist });
                    }
                }
                
                const finalRough = roughMatches.sort((a, b) => b.score - a.score).slice(0, fuzzyLimit);
                self.postMessage({ id, results: finalRough.map(p => ({
                    id: p.id, title: p.t, author: p.a, dynasty: p.d, lines: p.content, matchedLine: p.matchedLine, score: p.score, note: p.note, trans: p.trans, shangxi: p.shangxi, tags: p.tags
                })) });
                return;
            }
            
            if (mode === 'general') {
                for (const p of poems) {
                    let matched = false;
                    if (p.t === query || p.a === query || p.t.includes(query) || p.a.includes(query)) {
                        exactMatches.push({ ...p, id: generatePseudoId(p.t, p.a), score: 100, matchedLine: p.content[0] });
                        matched = true;
                    }

                    if (!matched) {
                        for (const line of p.content) {
                            if (line.includes(query)) {
                                exactMatches.push({ ...p, id: generatePseudoId(p.t, p.a), matchedLine: line, score: 90 });
                                matched = true;
                                break;
                            }
                        }
                    }
                }

                if (exactMatches.length > 0) {
                    const finalExact = exactMatches.sort((a, b) => b.score - a.score).slice(0, exactLimit);
                    self.postMessage({ id, results: finalExact.map(p => ({
                        id: p.id, title: p.t, author: p.a, dynasty: p.d, lines: p.content, matchedLine: p.matchedLine, score: p.score, note: p.note, trans: p.trans, shangxi: p.shangxi, tags: p.tags
                    })) });
                    return;
                }

                for (const p of poems) {
                    let bestDist = 999;
                    let bestLine = "";
                    for (const line of p.content) {
                        if (!sharesEnoughChars(line, query)) continue;
                        
                        if (Math.abs(line.length - query.length) < 5) {
                            const dist = levenshtein(line.replace(/[^\u4e00-\u9fa5]/g, ""), query.replace(/[^\u4e00-\u9fa5]/g, ""));
                            if (dist < bestDist) { bestDist = dist; bestLine = line; }
                        } else {
                            const cleanLineForSub = line.replace(/[^\u4e00-\u9fa5]/g, "");
                            const cleanQueryForSub = query.replace(/[^\u4e00-\u9fa5]/g, "");
                            for (let i = 0; i <= cleanLineForSub.length - cleanQueryForSub.length; i++) {
                                const sub = cleanLineForSub.substring(i, i + cleanQueryForSub.length);
                                const dist = levenshtein(sub, cleanQueryForSub);
                                if (dist < bestDist) { bestDist = dist; bestLine = line; }
                            }
                        }
                    }
                    if (bestDist <= 2) { 
                        roughMatches.push({ ...p, id: generatePseudoId(p.t, p.a), matchedLine: bestLine, score: 50 - bestDist });
                    }
                }
                
                const finalRough = roughMatches.sort((a, b) => b.score - a.score).slice(0, fuzzyLimit);
                self.postMessage({ id, results: finalRough.map(p => ({
                    id: p.id, title: p.t, author: p.a, dynasty: p.d, lines: p.content, matchedLine: p.matchedLine, score: p.score, note: p.note, trans: p.trans, shangxi: p.shangxi, tags: p.tags
                })) });
                return;
            }
        }
        
    } catch (err: any) {
        self.postMessage({ id, error: err.message });
    }
});
