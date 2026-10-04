const fs = require('fs');
let content = fs.readFileSync('src/lib/dbSearch.ts', 'utf8');

const target = `export interface PoemResult {
  _id: string;
  name: string;
  author: string;
  dynasty: string;
  content: string[];
  note: string;
  matchedLine: string;
  matchedLineIndex: number;
}`;

const replace = `export interface PoemResult {
  _id: string;
  name: string;
  author: string;
  dynasty: string;
  content: string[];
  note: string;
  trans?: string;
  shangxi?: string;
  tags?: string[];
  matchedLine: string;
  matchedLineIndex: number;
}`;

content = content.replace(target, replace);
fs.writeFileSync('src/lib/dbSearch.ts', content);
