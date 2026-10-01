async function run() {
    const res = await fetch("http://localhost:3000/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "床前明月光" })
    });
    console.log(res.status, await res.text());
}
run();
