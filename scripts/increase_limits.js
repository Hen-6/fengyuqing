const fs = require('fs');

let content = fs.readFileSync('src/components/games/FeihuaGame.tsx', 'utf8');

// Increase limit from 15 to 50 for searchOnline line search
content = content.replace(/searchOnline\(cleanL, 15, 'line'\)/g, "searchOnline(cleanL, 50, 'line')");
content = content.replace(/searchOnline\(cleanInput, 15, 'line'\)/g, "searchOnline(cleanInput, 50, 'line')");

fs.writeFileSync('src/components/games/FeihuaGame.tsx', content);

let dbContent = fs.readFileSync('src/lib/dbSearch.ts', 'utf8');
dbContent = dbContent.replace(/export async function searchByChar\(char: string, maxResults = 200/, "export async function searchByChar(char: string, maxResults = 500");
fs.writeFileSync('src/lib/dbSearch.ts', dbContent);

console.log("Limits increased.");
