const fs = require('fs');
const path = 'src/app/search/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add states
const stateInjection = `
  const { saveCustomPoem } = useUser();
  const [searchingFull, setSearchingFull] = useState(false);
  const [fullResults, setFullResults] = useState<any[]>([]);
  const [selectedFullPoem, setSelectedFullPoem] = useState<any>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [editContent, setEditContent] = useState("");

  const handleDeepSearch = useCallback(async () => {
    if (!debouncedQuery.trim()) return;
    setSearchingFull(true);
    setFullResults([]);
    try {
        const res = await searchFullDataset(debouncedQuery.trim(), 50);
        setFullResults(res || []);
    } catch (e) {
        console.error(e);
    } finally {
        setSearchingFull(false);
    }
  }, [debouncedQuery]);
`;
code = code.replace(/const \[allLoaded, setAllLoaded\] = useState\(false\);/, 'const [allLoaded, setAllLoaded] = useState(false);\n' + stateInjection);

// 2. Add UI for deep search and modal
const uiInjection = `
        {/* Deep Search Section */}
        {!searching && debouncedQuery && (
          <div className="pt-6 border-t border-border flex flex-col items-center">
            <button
              onClick={handleDeepSearch}
              disabled={searchingFull}
              className="px-6 py-3 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 transition disabled:opacity-50"
            >
              {searchingFull ? "正在 37 万全量古籍库中深度检索..." : "去 37 万首全量古籍库中深度搜索"}
            </button>
            
            {fullResults.length > 0 && (
              <div className="mt-6 w-full space-y-4">
                <h3 className="text-sm text-text-muted text-center mb-4">全量库检索结果 (供人工核对收编)</h3>
                {fullResults.map((p, i) => (
                  <div key={i} className="p-4 rounded-xl border border-border bg-surface text-left">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-ink">{p.t}</div>
                        <div className="text-xs text-text-muted mt-1">[{p.d || '未知'}] {p.a}</div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedFullPoem(p);
                          setEditTitle(p.t);
                          setEditAuthor(p.a);
                          setEditContent(p.content.join('\\n'));
                        }}
                        className="px-3 py-1.5 bg-accent/10 text-accent text-xs rounded-lg hover:bg-accent/20 transition"
                      >
                        修改并导入
                      </button>
                    </div>
                    {p.matchedLine && (
                      <div className="text-sm mt-3 opacity-80" dangerouslySetInnerHTML={{ __html: p.matchedLine }}></div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {searchingFull === false && fullResults.length === 0 && (
               // No results message, handled implicitly
               null
            )}
          </div>
        )}

        {/* Edit Modal */}
        {selectedFullPoem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-surface rounded-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-4 border-b border-border font-bold flex justify-between items-center">
                <span>净化并收编诗词</span>
                <button onClick={() => setSelectedFullPoem(null)} className="text-text-muted hover:text-ink">✕</button>
              </div>
              <div className="p-4 overflow-y-auto space-y-4">
                <div>
                  <label className="text-xs text-text-muted block mb-1">标题 (请去掉书名号等乱码)</label>
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full border rounded p-2 bg-paper" />
                </div>
                <div>
                  <label className="text-xs text-text-muted block mb-1">作者</label>
                  <input value={editAuthor} onChange={e => setEditAuthor(e.target.value)} className="w-full border rounded p-2 bg-paper" />
                </div>
                <div>
                  <label className="text-xs text-text-muted block mb-1">正文 (请修改错别字，每句一行)</label>
                  <textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="w-full border rounded p-2 bg-paper h-48 text-sm" />
                </div>
              </div>
              <div className="p-4 border-t border-border flex justify-end">
                <button 
                  className="px-6 py-2 bg-accent text-white rounded-xl hover:bg-accent/90"
                  onClick={async () => {
                     const customP = {
                        t: editTitle.trim(),
                        a: editAuthor.trim(),
                        d: selectedFullPoem.d || "未知",
                        content: editContent.split('\\n').map(l => l.trim()).filter(Boolean),
                        note: selectedFullPoem.note || "",
                        trans: selectedFullPoem.trans || "",
                        shangxi: selectedFullPoem.shangxi || ""
                     };
                     saveCustomPoem(customP);
                     const key = customP.t + ':' + customP.a;
                     upsertPoemProgress(key, (prev) => prev); // Auto-add to progress
                     setSelectedFullPoem(null);
                     alert("收编成功！这首诗已永久加入你的小字库，飞花令和寻花令现在都可以完美识别它了。");
                  }}
                >
                  保存并永久收编
                </button>
              </div>
            </div>
          </div>
        )}
`;

code = code.replace(/\{results\.length > visibleCount && \(/, uiInjection + '\n        {results.length > visibleCount && (');

fs.writeFileSync(path, code);
