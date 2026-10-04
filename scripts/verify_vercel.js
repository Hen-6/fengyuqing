async function run() {
    const baseUrl = "https://fengyuqing.vercel.app/api/search";
    
    console.log("=== 1. Testing Mode: 'char' (Feihua Ling Start) ===");
    const resChar = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "月", mode: "char", limit: 3 })
    });
    console.log("Status:", resChar.status);
    const dataChar = await resChar.json();
    console.log("Results count:", dataChar.results?.length);
    if(dataChar.results?.length > 0) {
        console.log("Sample matchedLine:", dataChar.results[0].matchedLine);
    }
    console.log("\n");

    console.log("=== 2. Testing Mode: 'line' (Exact Match) ===");
    const resLineExact = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "床前明月光", mode: "line", limit: 5 })
    });
    const dataLineExact = await resLineExact.json();
    console.log("Results count:", dataLineExact.results?.length);
    console.log("Titles:", dataLineExact.results?.map(r => r.title).join(", "));
    console.log("\n");

    console.log("=== 3. Testing Mode: 'line' (Fuzzy Match) ===");
    const resLineFuzzy = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "床前看月光", mode: "line", limit: 5 })
    });
    const dataLineFuzzy = await resLineFuzzy.json();
    console.log("Results count:", dataLineFuzzy.results?.length);
    console.log("Titles:", dataLineFuzzy.results?.map(r => r.title).join(", "));
    console.log("\n");

    console.log("=== 4. Testing Mode: 'general' (Title Match) ===");
    const resGeneral = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "静夜思", mode: "general", limit: 5 })
    });
    const dataGeneral = await resGeneral.json();
    console.log("Results count:", dataGeneral.results?.length);
    console.log("Titles:", dataGeneral.results?.map(r => r.title).join(", "));
    console.log("\n");

}
run();
