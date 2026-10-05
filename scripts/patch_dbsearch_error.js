const fs = require('fs');

const path = 'src/lib/dbSearch.ts';
let code = fs.readFileSync(path, 'utf8');

const searchFullOld = `
        const handler = (e: MessageEvent) => {
            if (e.data.type === 'SEARCH_FULL_RESULT' && e.data.id === id) {
                worker?.removeEventListener('message', handler);
                resolve(e.data.results);
            }
        };
`;

const searchFullNew = `
        const handler = (e: MessageEvent) => {
            if (e.data.id === id) {
                if (e.data.type === 'SEARCH_FULL_RESULT') {
                    worker?.removeEventListener('message', handler);
                    resolve(e.data.results);
                } else if (e.data.error) {
                    worker?.removeEventListener('message', handler);
                    console.error("Worker error:", e.data.error);
                    resolve([]);
                }
            }
        };
`;

code = code.replace(searchFullOld, searchFullNew);

fs.writeFileSync(path, code);
