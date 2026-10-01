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

export async function POST(req: Request) {
    try {
        const { query, mode } = await req.json();
        if (!query) return NextResponse.json({ results: [] });
        
        const poems = poemsData as any[];
        
        let exactMatches = [];
        let roughMatches = [];

        if (mode === 'char') {
            for (const p of poems) {
                for (const line of p.content) {
                    if (line.includes(query)) {
                        exactMatches.push({ ...p, score: 100, matchedLine: line });
                        break;
                    }
                }
                if (exactMatches.length >= 20) break;
            }
        } else {
            for (const p of poems) {
                let matched = false;
                if (p.t === query || p.a === query || p.t.includes(query) || p.a.includes(query)) {
                    exactMatches.push({ ...p, score: 100 });
                    continue;
                }

                for (const line of p.content) {
                    if (line.includes(query)) {
                        exactMatches.push({ ...p, matchedLine: line, score: 90 });
                        matched = true;
                        break;
                    }
                }
                if (matched) continue;

                if (exactMatches.length < 5) {
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
                    if (bestDist <= 1) { 
                        roughMatches.push({ ...p, matchedLine: bestLine, score: 50 - bestDist });
                    }
                }
            }
        }

        const finalExact = exactMatches.sort((a, b) => b.score - a.score).slice(0, mode === 'char' ? 20 : 5);
        const finalRough = roughMatches.sort((a, b) => b.score - a.score).slice(0, 5);

        const combined = [...finalExact, ...finalRough]
            .map(p => ({
                id: p.id,
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
