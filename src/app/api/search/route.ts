import { NextResponse } from 'next/server';
import poemsData from '../../../../data/poems.json';

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

// Fast pre-check to avoid Levenshtein on completely unrelated strings
function sharesEnoughChars(line: string, query: string): boolean {
    let matchCount = 0;
    for (let i = 0; i < query.length; i++) {
        if (line.includes(query[i])) {
            matchCount++;
        }
    }
    // Must share at least half the characters (rounded down)
    return matchCount >= Math.floor(query.length / 2);
}

export async function POST(req: Request) {
    try {
        const { query, mode, limit } = await req.json();
        if (!query) return NextResponse.json({ results: [] });
        
        const poems = poemsData as any[];
        const exactLimit = limit || (mode === 'char' ? 200 : 5);
        // User explicitly wants strictly 5 max for fuzzy search!
        const fuzzyLimit = 5; 
        
        let exactMatches = [];
        let roughMatches = [];

        // MODE: CHAR (Extremely fast, body only, substring)
        if (mode === 'char') {
            for (const p of poems) {
                for (const line of p.content) {
                    if (line.includes(query)) {
                        exactMatches.push({ ...p, score: 100, matchedLine: line });
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
        
        // MODE: LINE (Sentence validation, body only)
        if (mode === 'line') {
            // Pass 1: EXACT MATCH
            for (const p of poems) {
                for (const line of p.content) {
                    if (line.includes(query)) {
                        exactMatches.push({ ...p, matchedLine: line, score: 100 });
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

            // Pass 2: FUZZY MATCH (Only if no exact matches exist)
            for (const p of poems) {
                let bestDist = 999;
                let bestLine = "";
                for (const line of p.content) {
                    if (!sharesEnoughChars(line, query)) continue; // Fast skip
                    
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
                    roughMatches.push({ ...p, matchedLine: bestLine, score: 50 - bestDist });
                }
            }
            
            const finalRough = roughMatches.sort((a, b) => b.score - a.score).slice(0, fuzzyLimit);
            return NextResponse.json({
                results: finalRough.map(p => ({
                    id: p.id, title: p.t, author: p.a, dynasty: p.d, lines: p.content, matchedLine: p.matchedLine, score: p.score
                }))
            });
        }
        
        // MODE: GENERAL (Search Page)
        if (mode === 'general') {
            // Pass 1: EXACT MATCH (Title, Author, Body)
            for (const p of poems) {
                let matched = false;
                if (p.t === query || p.a === query || p.t.includes(query) || p.a.includes(query)) {
                    exactMatches.push({ ...p, score: 100, matchedLine: p.content[0] });
                    matched = true;
                }

                if (!matched) {
                    for (const line of p.content) {
                        if (line.includes(query)) {
                            exactMatches.push({ ...p, matchedLine: line, score: 90 });
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

            // Pass 2: FUZZY MATCH
            for (const p of poems) {
                let bestDist = 999;
                let bestLine = "";
                for (const line of p.content) {
                    if (!sharesEnoughChars(line, query)) continue; // Fast skip
                    
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
                    roughMatches.push({ ...p, matchedLine: bestLine, score: 50 - bestDist });
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
