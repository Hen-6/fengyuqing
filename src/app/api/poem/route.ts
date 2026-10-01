import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

let globalPoemsCache: any[] | null = null;

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const title = url.searchParams.get('title');
        const author = url.searchParams.get('author');

        if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });

        if (!globalPoemsCache) {
            const p = path.join(process.cwd(), 'public', 'data', 'SUPER_DATASET_DEDUPED.json.gz');
            const gz = fs.readFileSync(p);
            const unzipped = zlib.gunzipSync(gz).toString('utf8');
            globalPoemsCache = JSON.parse(unzipped).poems;
        }

        const poems = globalPoemsCache!;
        
        let match = null;
        for (const p of poems) {
            if (p.t === title && (!author || p.a === author)) {
                match = p;
                break;
            }
        }

        if (match) {
            return NextResponse.json({ poem: match });
        } else {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
