async function run() {
    let attempts = 0;
    while(attempts < 30) {
        try {
            const res = await fetch("https://fengyuqing.vercel.app/api/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // "月光床前明" has no exact match, so it will fall back to fuzzy!
                body: JSON.stringify({ query: "月光床前明", mode: "line", limit: 15 })
            });
            const data = await res.json();
            console.log(`[Attempt ${attempts}] Results count: ${data.results?.length}`);
            
            // If the code is updated, it forces a strict fuzzyLimit = 5, even if limit = 15!
            if (data.results?.length <= 5 && data.results?.length > 0) {
                console.log("✅ SUCCESS! Vercel deployed the latest commit!");
                console.log("Titles:", data.results.map(r => r.title).join(", "));
                process.exit(0);
            }
        } catch (e) {
            console.error(e.message);
        }
        attempts++;
        await new Promise(r => setTimeout(r, 10000));
    }
    console.log("❌ FAILED. Vercel deployment timed out.");
    process.exit(1);
}
run();
