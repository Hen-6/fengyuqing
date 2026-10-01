import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

let globalPoemsCache: any[] | null = null;

function levenshtein(s: string, t: string) {
    if (!s.length) return t.length;
    if (!t.length) return s.length;
    const arr = [];
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

export async function POST(req: Request) {
    try {
        const { query, mode, limit } = await req.json();
        if (!query) return NextResponse.json({ results: [] });
        
        if (!globalPoemsCache) {
            const p = path.join(process.cwd(), 'public', 'data', 'SUPER_DATASET_DEDUPED.json.gz');
            const gz = fs.readFileSync(p);
            const unzipped = zlib.unzipSync(gz).toString('utf8');
            globalPoemsCache = JSON.parse(unzipped).poems;
        }
        
        const poems = globalPoemsCache!;
        const exactLimit = limit || (mode === 'char' ? 200 : 5);
        const fuzzyLimit = 5; 
        
        let exactMatches = [];
        let roughMatches = [];

        if (mode === 'char') {
            for (const p of poems) {
                for (const line of p.content) {
                    if (line.includes(query)) {
                        exactMatches.push({ ...p, id: generatePseudoId(p.t, p.a), score: 100, matchedLine: line });
                        break;
                    }
                }
                if (exactMatches.length >= exactLimit) break;
            }
            return NextResponse.json({
                results: exactMatches.map(p => ({
                    id: p.id, title: p.t, author: p.a, dynasty: p.d, lines: p.content, matchedLine: p.matchedLine, score: p.score
                }))
            });
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
                return NextResponse.json({
                    results: finalExact.map(p => ({
                        id: p.id, title: p.t, author: p.a, dynasty: p.d, lines: p.content, matchedLine: p.matchedLine, score: p.score
                    }))
                });
            }

            for (const p of poems) {
                let bestDist = 999;
                let bestLine = "";
                for (const line of p.content) {
                    if (!sharesEnoughChars(line, query)) continue;
                    
                    if (Math.abs(line.length - query.length) < 5) {
                        const dist = levenshtein(line, query);
                        if (dist < bestDist) { bestDist = dist; bestLine = line; }
                    } else {
                        for (let i = 0; i <= line.length - query.length; i++) {
                            const sub = line.substring(i, i + query.length);
                            const dist = levenshtein(sub, query);
                            if (dist < bestDist) { bestDist = dist; bestLine = line; }
                        }
                    }
                }
                if (bestDist <= 2) { 
                    roughMatches.push({ ...p, id: generatePseudoId(p.t, p.a), matchedLine: bestLine, score: 50 - bestDist });
                }
            }
            
            const finalRough = roughMatches.sort((a, b) => b.score - a.score).slice(0, fuzzyLimit);
            return NextResponse.json({
                results: finalRough.map(p => ({
                    id: p.id, title: p.t, author: p.a, dynasty: p.d, lines: p.content, matchedLine: p.matchedLine, score: p.score
                }))
            });
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
                return NextResponse.json({
                    results: finalExact.map(p => ({
                        id: p.id, title: p.t, author: p.a, dynasty: p.d, lines: p.content, matchedLine: p.matchedLine, score: p.score
                    }))
                });
            }

            for (const p of poems) {
                let bestDist = 999;
                let bestLine = "";
                for (const line of p.content) {
                    if (!sharesEnoughChars(line, query)) continue;
                    
                    if (Math.abs(line.length - query.length) < 5) {
                        const dist = levenshtein(line, query);
                        if (dist < bestDist) { bestDist = dist; bestLine = line; }
                    } else {
                        for (let i = 0; i <= line.length - query.length; i++) {
                            const sub = line.substring(i, i + query.length);
                            const dist = levenshtein(sub, query);
                            if (dist < bestDist) { bestDist = dist; bestLine = line; }
                        }
                    }
                }
                if (bestDist <= 2) { 
                    roughMatches.push({ ...p, id: generatePseudoId(p.t, p.a), matchedLine: bestLine, score: 50 - bestDist });
                }
            }
            
            const finalRough = roughMatches.sort((a, b) => b.score - a.score).slice(0, fuzzyLimit);
            return NextResponse.json({
                results: finalRough.map(p => ({
                    id: p.id, title: p.t, author: p.a, dynasty: p.d, lines: p.content, matchedLine: p.matchedLine, score: p.score
                }))
            });
        }

        return NextResponse.json({ results: [] });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
