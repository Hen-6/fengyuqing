async function run() {
    console.time("Fetch");
    const res = await fetch("https://raw.githubusercontent.com/Hen-6/fengyuqing/main/data/poems.json");
    const data = await res.json();
    console.timeEnd("Fetch");
    console.log(data.length);
}
run();
