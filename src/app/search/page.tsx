"use client";

import { useState, useEffect } from "react";
import { searchOnline, searchFullDataset, PoemResult, getPoemByKeyExport } from "@/lib/dbSearch";
import { useUser } from "@/lib/userContext";
import { OnlinePoemCard } from "@/components/ui/OnlinePoemCard";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PoemResult[]>([]);
  const [fullResults, setFullResults] = useState<PoemResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchingFull, setSearchingFull] = useState(false);
  const [searchMode, setSearchMode] = useState<'title' | 'content'>('content');
  
  const [editingPoem, setEditingPoem] = useState<PoemResult | null>(null);
  const [editT, setEditT] = useState("");
  const [editContent, setEditContent] = useState("");

  const { saveCustomPoem, upsertPoemProgress } = useUser();

  useEffect(() => {
    if (query.trim().length === 0) {
      setResults([]);
      setFullResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setSearching(true);
      const res = await searchOnline(query, 50, searchMode);
      setResults(res);
      setFullResults([]);
      setSearching(false);
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [query, searchMode]);

  const handleDeepSearch = async () => {
    if (!query.trim()) return;
    setSearchingFull(true);
    const res = await searchFullDataset(query, 50);
    setFullResults(res);
    setSearchingFull(false);
  };

  const handleEditClick = (p: PoemResult) => {
    setEditingPoem(p);
    setEditT(p.t);
    setEditContent(p.content.join("\n"));
  };

  const handleSaveImport = async () => {
    if (!editingPoem) return;
    const newContent = editContent.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    const customPoem: PoemResult = {
      ...editingPoem,
      t: editT,
      content: newContent,
    };
    // Save to local storage and worker
    saveCustomPoem(customPoem);
    
    // Check if it exists in current pool, if not it will be now!
    // We auto-add it to user progress so it shows up in Learn Mode
    const key = `${customPoem.t}:${customPoem.a}`;
    await upsertPoemProgress(key, 0); // initial review

    setEditingPoem(null);
    alert("已成功修改并导入到你的个人诗词库！现在飞花令和学习模式都能正常使用它了。");
  };

  return (
    <main className="min-h-screen bg-paper bg-shuimo bg-cover bg-center bg-fixed font-serif text-ink p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-center tracking-widest text-ink mt-8">
          诗词检索
        </h1>

        <div className="bg-paper/80 backdrop-blur-md rounded-xl p-4 shadow-xl border border-ink/10">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSearchMode('content')}
              className={`px-4 py-2 rounded ${searchMode === 'content' ? 'bg-primary text-white' : 'bg-ink/10'}`}
            >
              按诗句搜索
            </button>
            <button
              onClick={() => setSearchMode('title')}
              className={`px-4 py-2 rounded ${searchMode === 'title' ? 'bg-primary text-white' : 'bg-ink/10'}`}
            >
              按标题/作者
            </button>
          </div>
          <input
            type="text"
            className="w-full bg-transparent border-b-2 border-ink/30 focus:border-primary p-2 text-xl outline-none"
            placeholder="输入诗句、拼音、标题或作者（支持拼音搜诗句）..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {searching && <p className="text-center text-ink/60">正在精修小库中检索...</p>}

        {!searching && results.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">精修小库搜索结果</h2>
            {results.map((p, idx) => (
              <OnlinePoemCard key={idx} result={p as any} />
            ))}
          </div>
        )}

        {!searching && query && (
          <div className="text-center space-y-4 mt-8">
            <p className="text-ink/60">
              没找到满意的诗词？或者想找冷门绝句？
            </p>
            <button
              onClick={handleDeepSearch}
              disabled={searchingFull}
              className="px-6 py-3 bg-secondary text-white rounded-full font-bold shadow-md hover:bg-secondary/90 transition-all disabled:opacity-50"
            >
              {searchingFull ? "正在 37 万全量古籍库中深度检索..." : "去 37 万首全量古籍库中深度搜索"}
            </button>
          </div>
        )}

        {fullResults.length > 0 && (
          <div className="space-y-4 mt-8 p-4 bg-primary/10 rounded-xl border border-primary/20">
            <h2 className="text-xl font-bold text-primary">全库深度检索结果</h2>
            <p className="text-sm text-ink/60 mb-4">
              这里是全量古籍库（37万首）的原始内容。你可以直接点击【修改并导入】，将它清理并加入你的专属小库中。
            </p>
            {fullResults.map((p, idx) => (
              <div key={idx} className="bg-paper rounded p-4 shadow mb-2 relative">
                <h3 className="text-lg font-bold">《{p.t}》</h3>
                <p className="text-sm text-ink/60 mb-2">{p.d} · {p.a}</p>
                <div className="space-y-1 mb-4 text-ink/80">
                  {p.content.slice(0, 4).map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                  {p.content.length > 4 && <p>...</p>}
                </div>
                <button
                  onClick={() => handleEditClick(p)}
                  className="px-4 py-2 bg-primary text-white rounded shadow text-sm absolute top-4 right-4"
                >
                  修改并导入
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingPoem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-paper w-full max-w-xl rounded-xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold">修改并导入诗词</h2>
            <p className="text-sm text-ink/60">
              全库抓取的古籍数据可能存在标题被生硬叫做“句”，或者字词（惹/染）使用繁体/异体字的问题。请你在这里亲自修正它们，保证你的诗词库一尘不染。
            </p>
            
            <div>
              <label className="block text-sm font-bold mb-1">标题修正</label>
              <input
                type="text"
                value={editT}
                onChange={e => setEditT(e.target.value)}
                className="w-full border border-ink/20 rounded p-2 bg-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold mb-1">内容修正（可修改错别字、异体字）</label>
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                rows={10}
                className="w-full border border-ink/20 rounded p-2 bg-transparent"
              />
            </div>

            <div className="flex gap-4 justify-end mt-4">
              <button
                onClick={() => setEditingPoem(null)}
                className="px-4 py-2 bg-ink/10 rounded"
              >
                取消
              </button>
              <button
                onClick={handleSaveImport}
                className="px-4 py-2 bg-primary text-white rounded font-bold"
              >
                保存并导入我的专属小库
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
