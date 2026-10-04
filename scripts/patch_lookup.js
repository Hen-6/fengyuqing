const fs = require('fs');
console.log("Loading lookup...");
const d = JSON.parse(fs.readFileSync('public/data/all_poems_lookup.json', 'utf8'));

console.log("Adding missing poems...");
d.poems.push({
    t: "道情",
    a: "白玉蟾",
    d: "宋代",
    content: ["白云黄鹤道人家，一琴一剑一杯茶。", "羽衣常带烟霞色，不染人间桃李花。"]
});

d.poems.push({
    t: "临江仙·梦后楼台高锁",
    a: "晏几道",
    d: "宋代",
    content: ["梦后楼台高锁，酒醒帘幕低垂。", "去年春恨却来时。", "落花人独立，微雨燕双飞。", "记得小蘋初见，两重心字罗衣。", "琵琶弦上说相思。", "当时明月在，曾照彩云归。"]
});

console.log("Writing lookup...");
fs.writeFileSync('public/data/all_poems_lookup.json', JSON.stringify(d));
console.log("Done. Total poems:", d.poems.length);
