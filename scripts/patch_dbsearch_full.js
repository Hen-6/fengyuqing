const fs = require('fs');
const path = 'src/lib/dbSearch.ts';
let code = fs.readFileSync(path, 'utf8');

code += `
export function searchFullDataset(query: string, limit = 50): Promise<PoemResult[]> {
    return new Promise((resolve) => {
        const id = Math.random().toString(36).substring(7);
        const handler = (e: MessageEvent) => {
            if (e.data.type === 'SEARCH_FULL_RESULT' && e.data.id === id) {
                worker.removeEventListener('message', handler);
                resolve(e.data.results);
            }
        };
        worker.addEventListener('message', handler);
        worker.postMessage({ type: 'SEARCH_FULL', query, limit, id });
    });
}

export function addCustomPoemsToWorker(poems: PoemResult[]): Promise<void> {
    return new Promise((resolve) => {
        const id = Math.random().toString(36).substring(7);
        const handler = (e: MessageEvent) => {
            if (e.data.type === 'ADD_CUSTOM_RESULT' && e.data.id === id) {
                worker.removeEventListener('message', handler);
                resolve();
            }
        };
        worker.addEventListener('message', handler);
        worker.postMessage({ type: 'ADD_CUSTOM', poems, id });
    });
}
`;

fs.writeFileSync(path, code);
