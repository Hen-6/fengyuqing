const fs = require('fs');
const path = 'src/lib/userContext.tsx';
let code = fs.readFileSync(path, 'utf8');

const target = '  // Read localStorage after mount (client only)\n  useEffect(() => {\n    const initial = loadStore();\n    const fresh = { ...initial, initialized: true };\n    _setStore(fresh);\n    setHydrated(true);\n  }, []);';

const newCode = `  // Read localStorage after mount (client only)
  useEffect(() => {
    const initial = loadStore();
    const fresh = { ...initial, initialized: true };
    _setStore(fresh);
    setHydrated(true);
    
    // Inject custom poems into worker on boot
    const customPoemsStr = localStorage.getItem("fengyuqing_custom_poems_v1");
    if (customPoemsStr) {
      try {
        const customPoems = JSON.parse(customPoemsStr);
        if (Array.isArray(customPoems) && customPoems.length > 0) {
          import("./dbSearch").then(db => db.addCustomPoemsToWorker(customPoems));
        }
      } catch (e) {
        console.error("Failed to inject custom poems", e);
      }
    }
  }, []);`;

code = code.replace(target, newCode);

fs.writeFileSync(path, code);
