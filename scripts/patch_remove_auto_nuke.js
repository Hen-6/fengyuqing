const fs = require('fs');

const path = 'src/lib/userContext.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Remove the auto nuke block
const startPattern = '// HARD NUKE REQUESTED BY USER';
const endPattern = '  // Automatically sweep invalid/garbage poems on load';

const startIndex = code.indexOf(startPattern);
const endIndex = code.indexOf(endPattern);

if (startIndex !== -1 && endIndex !== -1) {
    const partToRemove = code.substring(startIndex, endIndex);
    code = code.replace(partToRemove, '');
} else {
    console.log("Could not find auto nuke block");
}

// 2. Add hardNuke function
const hardNukeFunc = `
  const hardNuke = useCallback(async () => {
    if (!userRef.current) return;
    const confirm1 = window.confirm("⚠️ 警告：你确定要彻底清空所有的学习进度吗？此操作不可逆！");
    if (!confirm1) return;
    
    try {
      await supabase
        .from("user_progress")
        .delete()
        .eq("user_id", userRef.current.id);
      
      localStorage.removeItem("fengyuqing_v1");
      const fresh = defaultStore();
      _setStore(fresh);
      saveStore(fresh);
      alert("已成功清空所有学习记录。");
    } catch (e) {
      console.error(e);
      alert("清空失败");
    }
  }, []);
`;

code = code.replace(/const \[overview, setOverview\] = useState/, hardNukeFunc + '\n  const [overview, setOverview] = useState');

// 3. Add to context interface
code = code.replace(/saveCustomPoem: \(poem: any\) => void;/, 'saveCustomPoem: (poem: any) => void;\n  hardNuke: () => Promise<void>;');

// 4. Add to returned value
code = code.replace(/saveCustomPoem,/, 'saveCustomPoem,\n      hardNuke,');
code = code.replace(/saveCustomPoem\]/, 'saveCustomPoem, hardNuke]');

fs.writeFileSync(path, code);
