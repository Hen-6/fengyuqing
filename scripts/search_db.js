const fs = require('fs');
const poems = JSON.parse(fs.readFileSync('data/poems.json', 'utf8'));

const findPoem = (query) => {
    console.log(`Searching for: ${query}`);
    const matches = poems.filter(p => p.content.some(line => line.includes(query)));
    if (matches.length > 0) {
        console.log(`Found ${matches.length} matches:`);
        matches.forEach(m => console.log(`- ${m.t} (${m.a})`));
    } else {
        console.log(`NO MATCHES FOUND for ${query}.`);
    }
}

findPoem("落花人独立");
findPoem("不染人间桃李花");
