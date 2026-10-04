async function run() {
    const start = Date.now();
    const res = await fetch("https://fengyuqing.vercel.app/data/all_poems_lookup.json");
    console.log("Fetch MS:", Date.now() - start);
    
    const startParse = Date.now();
    const data = await res.json();
    console.log("Parse MS:", Date.now() - startParse);
    
    console.log("Count:", data.poems.length);
}
run();
