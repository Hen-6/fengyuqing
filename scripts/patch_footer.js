const fs = require('fs');
const path = 'src/app/page.tsx';
let code = fs.readFileSync(path, 'utf8');

const targetStr = `          <p>归去，也无风雨也无晴</p>
          <p className="mt-1 opacity-60">风雨情 · 古诗词练习平台</p>
        </div>`;

const replacementStr = `          <p>归去，也无风雨也无晴</p>
          <p className="mt-1 opacity-60">风雨情 · 古诗词练习平台</p>
          <p className="mt-2 opacity-50"><Link href="/privacy" className="underline hover:text-accent transition">隐私政策 (Privacy Policy)</Link></p>
        </div>`;

code = code.replace(targetStr, replacementStr);
fs.writeFileSync(path, code);
