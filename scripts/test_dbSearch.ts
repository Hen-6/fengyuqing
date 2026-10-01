import { searchOnline } from '../src/lib/dbSearch';
async function run() {
    const res = await searchOnline("床前看月光");
    console.log(JSON.stringify(res, null, 2));
}
run();
