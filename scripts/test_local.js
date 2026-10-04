async function run() {
    const resLineExact = await fetch("http://localhost:3000/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "床前明月光", mode: "line", limit: 5 })
    });
    const dataLineExact = await resLineExact.json();
    console.log("Local Results count:", dataLineExact.results?.length);
    console.log("Local Titles:", dataLineExact.results?.map(r => r.title).join(", "));
}
run();
