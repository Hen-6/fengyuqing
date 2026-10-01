import { searchOnline } from '../src/lib/dbSearch';

const originalFetch = global.fetch;
global.fetch = async (url, options) => {
    if (typeof url === 'string' && url.startsWith('/')) {
        url = 'http://localhost:3000' + url;
    }
    return originalFetch(url, options);
};

async function run() {
    const res = await searchOnline("床前看月光");
    console.log(res);
}
run();
