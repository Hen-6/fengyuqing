async function run() {
    let attempts = 0;
    while(attempts < 30) {
        try {
            const res = await fetch("https://fengyuqing.vercel.app/api/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: "床前明月光", mode: "line", limit: 5 })
            });
            const data = await res.json();
            console.log(`[Attempt ${attempts}] Results count: ${data.results?.length}`);
            if (data.results?.length === 1) {
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
