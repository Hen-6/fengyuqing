import { NextResponse } from 'next/server';
import poems from '../../../../data/poems.json';

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

export async function POST(req: Request) {
    try {
        const { query, mode } = await req.json();
        if (!query) return NextResponse.json({ results: [] });
        
        let exactMatches = [];
        let roughMatches = [];

        if (mode === 'char') {
            for (const p of poems) {
                for (const line of p.content) {
                    if (line.includes(query)) {
                        exactMatches.push({ ...p, score: 100, matchedLine: line });
                        if (exactMatches.length >= 20) break;
                    }
                }
                if (exactMatches.length >= 20) break;
            }
        } else {
            for (const p of poems) {
                let matched = false;
                // 1. Exact Match Title/Author
                if (p.t === query || p.a === query || p.t.includes(query) || p.a.includes(query)) {
                    exactMatches.push({ ...p, score: 100 });
                    continue;
                }

                // 2. Exact match in body
                for (const line of p.content) {
                    if (line.includes(query)) {
                        exactMatches.push({ ...p, matchedLine: line, score: 90 });
                        matched = true;
                        break;
                    }
                }
                if (matched) continue;

                // 3. Fuzzy match body
                if (exactMatches.length < 10) {
                    let bestDist = 999;
                    let bestLine = "";
                    for (const line of p.content) {
                        if (Math.abs(line.length - query.length) < 5) {
                            const dist = levenshtein(line, query);
                            if (dist < bestDist) {
                                bestDist = dist;
                                bestLine = line;
                            }
                        } else {
                            for (let i = 0; i <= line.length - query.length; i++) {
                                const sub = line.substring(i, i + query.length);
                                const dist = levenshtein(sub, query);
                                if (dist < bestDist) {
                                    bestDist = dist;
                                    bestLine = line;
                                }
                            }
                        }
                    }
                    if (bestDist <= 1) { // Very strict fuzzy to avoid slow search and junk
                        roughMatches.push({ ...p, matchedLine: bestLine, score: 50 - bestDist });
                    }
                }
            }
        }

        const combined = [...exactMatches, ...roughMatches]
            .sort((a, b) => b.score - a.score)
            .slice(0, mode === 'char' ? 20 : 10)
            .map(p => ({
                title: p.t,
                author: p.a,
                dynasty: p.d,
                lines: p.content,
                matchedLine: p.matchedLine
            }));

        return NextResponse.json({ results: combined });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
