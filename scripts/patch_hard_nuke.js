const fs = require('fs');

const path = 'src/lib/userContext.tsx';
let code = fs.readFileSync(path, 'utf8');

const injection = `
  // HARD NUKE REQUESTED BY USER
  useEffect(() => {
    if (!hydrated || !userRef.current) return;
    
    const hasHardNuked = localStorage.getItem("fengyuqing_hard_nuked_v5");
    if (!hasHardNuked) {
      console.log("EXECUTING HARD NUKE OF ALL PROGRESS...");
      
      // 1. Nuke Cloud
      supabase
        .from("user_progress")
        .delete()
        .eq("user_id", userRef.current.id)
        .then(() => {
           console.log("Cloud nuked.");
        });
        
      // 2. Nuke Local
      localStorage.removeItem("fengyuqing_v1");
      
      // 3. Reset in-memory store
      const fresh = defaultStore();
      _setStore(fresh);
      saveStore(fresh);
      
      localStorage.setItem("fengyuqing_hard_nuked_v5", "true");
      alert("已经为你强制格式化了所有乱七八糟的历史学习进度！现在是一个100%纯净的开始。");
    }
  }, [hydrated, user]);
`;

code = code.replace(/const \[overview, setOverview\] = useState/s, match => injection + '\n  ' + match);

fs.writeFileSync(path, code);
