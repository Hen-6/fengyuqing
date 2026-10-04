const fs = require('fs');
let content = fs.readFileSync('src/lib/userContext.tsx', 'utf8');

const target = `    if (typeof window !== "undefined" && !(window as any).hasHardWiped) {
      (window as any).hasHardWiped = true;
      console.log("HARD WIPE EXECUTING");
      localStorage.removeItem("fengyuqing_v1");
      const fresh = { overview: { version: 1, lastSync: 0 }, poems: {} };
      _setStore(fresh);
      alert("已按照您的要求，彻底清空了所有的学习进度。系统已恢复为最初的纯净状态。");
    }`;

content = content.replace(target, '');
fs.writeFileSync('src/lib/userContext.tsx', content);
