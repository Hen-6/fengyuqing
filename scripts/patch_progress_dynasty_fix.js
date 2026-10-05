const fs = require('fs');
const path = 'src/app/progress/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Extract the useEffect block
const effectStart = code.indexOf('  const [workerLookupMap');
const effectEnd = code.indexOf('  }, [allLoaded, practiced.length]); // length is enough to trigger when new ones are added') + 86; // add length of that line
const block = code.slice(effectStart, effectEnd) + '\n';
code = code.slice(0, effectStart) + code.slice(effectEnd);

// 2. Insert it after const practiced = ...;
const insertTarget = '  );\\n';
code = code.replace(/(const practiced = .*?\n.*?  \);\n)/, '$1' + block);

fs.writeFileSync(path, code);
