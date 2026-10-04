import { matchPinyin, getCleanPinyin } from '../src/lib/pinyinUtils';

const text = "取次花丛懒回顾半缘修道半缘君";
const clean = "取次花丛懒回顾半缘修道半缘俊";

console.log("text pinyin:", getCleanPinyin(text));
console.log("clean pinyin:", getCleanPinyin(clean));
console.log("matchPinyin:", matchPinyin(text, clean));
