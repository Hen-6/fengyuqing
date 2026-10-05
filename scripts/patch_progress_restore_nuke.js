const fs = require('fs');
const path = 'src/app/progress/page.tsx';
let code = fs.readFileSync(path, 'utf8');

const targetStr = `        })}
      </div>
    </div>
  );
}`;

const replacementStr = `        })}

        <div className="mt-12 mb-8 flex justify-center">
          <button
            onClick={hardNuke}
            className="px-6 py-2 border-2 border-red-500/50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all text-sm font-bold shadow-sm"
          >
            ⚠️ 彻底清空所有学习记录
          </button>
        </div>
      </div>
    </div>
  );
}`;

code = code.replace(targetStr, replacementStr);
fs.writeFileSync(path, code);
