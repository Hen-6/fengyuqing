const fs = require('fs');
const poems = JSON.parse(fs.readFileSync('data/poems.json', 'utf8'));

const findTitle = (query) => {
    console.log(`Searching Title: ${query}`);
    const matches = poems.filter(p => p.t.includes(query) || p.a.includes(query) || p.content.some(l => l.includes(query)));
    if (matches.length > 0) {
        console.log(`Found ${matches.length} matches:`);
        matches.slice(0, 5).forEach(m => console.log(`- ${m.t} (${m.a})`));
    } else {
        console.log(`NO MATCHES FOUND for ${query}.`);
    }
}

findTitle("临江仙");
findTitle("晏几道");
findTitle("微雨燕双飞");
findTitle("桃李花");
