const fs = require('fs');

const path = 'src/app/search/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add editDynasty state
code = code.replace(/const \[editAuthor, setEditAuthor\] = useState\(""\);/, 'const [editAuthor, setEditAuthor] = useState("");\n  const [editDynasty, setEditDynasty] = useState("");');

// 2. Set editDynasty when button is clicked
const oldSetState = `setEditTitle(p.t);
                          setEditAuthor(p.a);
                          setEditContent(p.content.join('\\n'));`;
const newSetState = `setEditTitle(p.t);
                          setEditAuthor(p.a);
                          setEditDynasty(p.d || "未知");
                          setEditContent(p.content.join('\\n'));`;
code = code.replace(oldSetState, newSetState);

// 3. Add Dynasty UI to modal
const oldUI = `                <div>
                  <label className="text-xs text-text-muted block mb-1">作者</label>
                  <input value={editAuthor} onChange={e => setEditAuthor(e.target.value)} className="w-full border rounded p-2 bg-paper" />
                </div>`;
const newUI = `                <div>
                  <label className="text-xs text-text-muted block mb-1">作者</label>
                  <input value={editAuthor} onChange={e => setEditAuthor(e.target.value)} className="w-full border rounded p-2 bg-paper" />
                </div>
                <div>
                  <label className="text-xs text-text-muted block mb-1">朝代</label>
                  <input value={editDynasty} onChange={e => setEditDynasty(e.target.value)} className="w-full border rounded p-2 bg-paper" />
                </div>`;
code = code.replace(oldUI, newUI);

// 4. Use editDynasty in save logic
const oldSave = `d: selectedFullPoem.d || "未知",`;
const newSave = `d: editDynasty.trim(),`;
code = code.replace(oldSave, newSave);

fs.writeFileSync(path, code);
