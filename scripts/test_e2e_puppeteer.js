const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const http = require('http');

async function waitForServer() {
    return new Promise((resolve) => {
        const interval = setInterval(() => {
            http.get('http://localhost:3000', (res) => {
                if (res.statusCode === 200) {
                    clearInterval(interval);
                    resolve();
                }
            }).on('error', () => {});
        }, 1000);
    });
}

(async () => {
    console.log("Starting Next.js server...");
    const server = spawn('pnpm', ['run', 'start'], { stdio: 'pipe' });
    
    server.stdout.on('data', data => console.log(`[Next] ${data}`));
    server.stderr.on('data', data => console.error(`[Next] ${data}`));
    
    await waitForServer();
    console.log("Server is up! Launching Puppeteer...");
    
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    console.log("Navigating to Feihua game...");
    await page.goto('http://localhost:3000/games/feihua', { waitUntil: 'networkidle0' });
    
    console.log("Starting game (clicking random character)...");
    await page.waitForSelector('button.btn-primary'); // "随机抽取"
    await page.click('button.btn-primary');
    
    console.log("Waiting a few seconds for dataset to decompress in browser...");
    await new Promise(r => setTimeout(r, 8000));
    
    console.log("Typing '鸟' in input...");
    await page.waitForSelector('input[type="text"]', { timeout: 10000 });
    // In Feihua, we just type the poem line containing the character!
    // But wait! The character is randomized!
    // We can't type "鸟" if the character is not "鸟"!
    // Actually, we can use the Global Search page to search for "鸟" which doesn't require a random character!
    console.log("Wait, this is feihua. Navigating to search page instead...");
    await page.goto('http://localhost:3000/search', { waitUntil: 'networkidle0' });
    
    console.log("Waiting a few seconds for dataset to decompress in browser...");
    await new Promise(r => setTimeout(r, 6000));
    
    await page.waitForSelector('input[type="text"]', { timeout: 10000 });
    await page.type('input[type="text"]', '鸟');
    await page.keyboard.press('Enter');
    
    console.log("Waiting for results...");
    await new Promise(r => setTimeout(r, 4000));
    
    const pageText = await page.evaluate(() => document.body.innerText);
    
    console.log("--- UI DUMP ---");
    console.log(pageText.substring(0, 1000));
    console.log("---------------");
    
    if (pageText.includes("千山鸟飞绝") || pageText.includes("处处闻啼鸟") || pageText.includes("鸟") && !pageText.includes("没有找到含")) {
        console.log("SUCCESS! Found '鸟' results in UI.");
    } else {
        console.error("FAILED! Did not find results or found error message.");
    }
    
    await browser.close();
    server.kill();
    process.exit(0);
})();
