"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useUser } from "@/lib/userContext";
import { generalSearch, searchByTag, getAllTags, SearchResult } from "@/lib/localSearch";
import { searchFullDataset } from "@/lib/dbSearch";
import { setLevel } from "@/lib/srs";
import { getPoemByKeyFast } from "@/data/allPoemsLookup";

const POPULAR_TAG_NAMES = [
  "唐诗三百首",
  "宋词三百首",
  "古诗三百首",
  "小学古诗",
  "初中古诗",
  "写景",
  "抒情",
  "思乡",
  "送别",
  "春天",
  "秋天",
  "爱国",
  "豪放",
  "婉约",
  "咏物",
  "哲理",
  "爱情",
  "友情"
];

export default function SearchPage() {
  const { store, loaded, upsertPoemProgress, deletePoemProgress } = useUser();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [allLoaded, setAllLoaded] = useState(false);

  // Tag filter state
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<{ name: string; count: number }[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [tagModalSearch, setTagModalSearch] = useState("");

  const { saveCustomPoem } = useUser();
  const [searchingFull, setSearchingFull] = useState(false);
  const [fullResults, setFullResults] = useState<any[]>([]);
  const [selectedFullPoem, setSelectedFullPoem] = useState<any>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [editDynasty, setEditDynasty] = useState("");
  const [editContent, setEditContent] = useState("");

  const [visibleCount, setVisibleCount] = useState(40);

  useEffect(() => {
    setAllLoaded(false);
    getAllTags().then((tags) => {
      if (tags && tags.length > 0) {
        setAllTags(tags);
      }
    });
  }, []);

  // Read initial query / tag from URL search params
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const q = params.get("q");
      const tag = params.get("tag");
      if (tag) {
        setSelectedTag(tag);
      }
      if (q) {
        setQuery(q);
        setDebouncedQuery(q);
      }
    }
  }, []);

  // Debounce input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 350);
    return () => clearTimeout(handler);
  }, [query]);

  // Execute search when query or selectedTag changes
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q && !selectedTag) {
      setResults([]);
      return;
    }

    let isMounted = true;
    setSearching(true);

    const searchPromise = selectedTag
      ? searchByTag(selectedTag, 2000, q)
      : generalSearch(q, 2000);

    searchPromise
      .then((res) => {
        if (isMounted) {
          setResults(res);
          setVisibleCount(40);
        }
      })
      .catch((err) => {
        console.error("Search failed:", err);
      })
      .finally(() => {
        if (isMounted) setSearching(false);
      });

    return () => {
      isMounted = false;
    };
  }, [debouncedQuery, selectedTag]);

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

  const handleTagClick = (tag: string) => {
    if (selectedTag === tag) {
      setSelectedTag(null);
    } else {
      setSelectedTag(tag);
    }
  };

  const filteredModalTags = useMemo(() => {
    const q = tagModalSearch.trim().toLowerCase();
    if (!q) return allTags;
    return allTags.filter((t) => t.name.toLowerCase().includes(q));
  }, [allTags, tagModalSearch]);

  if (!loaded) return null;

  return (
    <div className="min-h-screen paper-texture px-6 pb-8 safe-pt">
      <div className="mx-auto max-w-md space-y-5">
        {/* Header */}
        <header className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center justify-center w-10 h-10 -ml-2 rounded-full text-2xl text-text-muted hover:text-accent hover:bg-black/5 active:bg-black/10 transition"
          >
            ←
          </Link>
          <div>
            <h1 className="text-xl font-bold text-ink">搜索诗词</h1>
            <p className="text-xs text-text-muted">支持作者、标题、诗句及主题标签检索</p>
          </div>
        </header>

        {/* Search Input Box */}
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              selectedTag
                ? `在「${selectedTag}」下搜索诗句、作者...`
                : "搜索作者、标题、名句或标签..."
            }
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 pl-10 pr-10 text-ink placeholder:text-text-muted focus:border-accent focus:outline-none transition shadow-xs"
            autoFocus
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">🔍</span>
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-stone-200/70 text-text-muted hover:text-ink text-xs transition"
            >
              ✕
            </button>
          )}
          {searching && !query && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted animate-pulse">
              搜索中...
            </span>
          )}
        </div>

        {/* Active Tag Banner */}
        {selectedTag && (
          <div className="flex items-center justify-between bg-accent/10 border border-accent/25 rounded-xl px-3.5 py-2 text-xs text-accent">
            <div className="flex items-center gap-1.5 font-medium">
              <span>已选标签：</span>
              <span className="font-bold">#{selectedTag}</span>
              {!searching && results.length > 0 && (
                <span className="opacity-80">({results.length} 首)</span>
              )}
            </div>
            <button
              onClick={() => setSelectedTag(null)}
              className="text-xs font-semibold hover:text-accent/80 flex items-center gap-1 transition"
            >
              清除标签 ✕
            </button>
          </div>
        )}

        {/* Tag Pills Filter Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-text-muted px-0.5">
            <span>常用标签推荐</span>
            <button
              onClick={() => setShowTagModal(true)}
              className="text-accent hover:underline flex items-center gap-0.5"
            >
              全部标签 ({allTags.length || "500+"}) →
            </button>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
            <button
              onClick={() => setSelectedTag(null)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full transition font-medium ${
                selectedTag === null
                  ? "bg-ink text-paper shadow-xs"
                  : "bg-surface border border-border text-text-muted hover:text-ink hover:border-ink/30"
              }`}
            >
              全部
            </button>
            {POPULAR_TAG_NAMES.map((tagName) => {
              const isActive = selectedTag === tagName;
              return (
                <button
                  key={tagName}
                  onClick={() => handleTagClick(tagName)}
                  className={`shrink-0 text-xs px-3 py-1.5 rounded-full transition font-medium ${
                    isActive
                      ? "bg-accent text-white shadow-xs"
                      : "bg-surface border border-border text-ink/80 hover:border-accent hover:text-accent"
                  }`}
                >
                  #{tagName}
                </button>
              );
            })}
          </div>
        </div>

        {/* No Results Message */}
        {(debouncedQuery.trim() || selectedTag) && !searching && results.length === 0 && (
          <div className="text-center text-text-muted py-10 text-sm space-y-2">
            <p>
              未找到包含{debouncedQuery.trim() ? `「${debouncedQuery}」` : ""}{selectedTag ? ` 标签「${selectedTag}」` : ""}的诗词
            </p>
            {selectedTag && (
              <button
                onClick={() => setSelectedTag(null)}
                className="text-xs text-accent underline mt-2"
              >
                清除标签筛选重试
              </button>
            )}
          </div>
        )}

        {/* Results List */}
        <div className="space-y-3.5">
          {results.slice(0, visibleCount).map((res) => {
            const pid = `${res.poem.name.trim()}:${res.poem.author.trim()}`;
            const lookup = allLoaded ? getPoemByKeyFast(pid) : null;
            const dynasty = lookup?.d || res.poem.dynasty || "未知";
            return (
              <SearchResultCard
                key={pid}
                result={res}
                dynasty={dynasty}
                currentLevel={store.poems[pid]?.level ?? 1}
                autoExpand={results.length === 1}
                selectedTag={selectedTag}
                onSelectTag={handleTagClick}
                onSetLevel={(lvl) => {
                  if (lvl === 1) {
                    deletePoemProgress(pid);
                  } else {
                    upsertPoemProgress(pid, (prev) => setLevel(prev, lvl));
                  }
                }}
              />
            );
          })}
        </div>

        {/* Pagination: Load More */}
        {results.length > visibleCount && (
          <div className="pt-2 text-center">
            <button
              onClick={() => setVisibleCount((prev) => prev + 60)}
              className="px-6 py-2.5 rounded-xl border border-border bg-surface text-sm font-medium text-ink hover:border-accent hover:text-accent transition shadow-xs active:scale-95"
            >
              加载更多诗词 (已显示 {Math.min(visibleCount, results.length)}/{results.length})
            </button>
          </div>
        )}

        {/* Deep Search Section */}
        {!searching && debouncedQuery && (
          <div className="pt-6 border-t border-border flex flex-col items-center">
            <button
              onClick={handleDeepSearch}
              disabled={searchingFull}
              className="px-6 py-3 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 transition disabled:opacity-50 text-sm shadow-xs"
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
                          setEditDynasty(p.d || "未知");
                          setEditContent(p.content.join('\n'));
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
          </div>
        )}

        {/* Edit & Import Modal */}
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
                  <label className="text-xs text-text-muted block mb-1">朝代</label>
                  <input value={editDynasty} onChange={e => setEditDynasty(e.target.value)} className="w-full border rounded p-2 bg-paper" />
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
                        d: editDynasty.trim(),
                        content: editContent.split('\n').map(l => l.trim()).filter(Boolean),
                        note: selectedFullPoem.note || "",
                        trans: selectedFullPoem.trans || "",
                        shangxi: selectedFullPoem.shangxi || ""
                     };
                     saveCustomPoem(customP);
                     const key = customP.t + ':' + customP.a;
                     upsertPoemProgress(key, (prev) => prev);
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

        {/* All Tags Sheet / Modal */}
        {showTagModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 animate-in fade-in">
            <div className="bg-surface rounded-t-3xl sm:rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-border flex justify-between items-center bg-surface">
                <div>
                  <h3 className="font-bold text-ink">全库诗词标签</h3>
                  <p className="text-xs text-text-muted mt-0.5">点击标签快速筛选对应诗词</p>
                </div>
                <button
                  onClick={() => setShowTagModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-stone-100 text-text-muted hover:text-ink text-sm transition"
                >
                  ✕
                </button>
              </div>

              {/* Tag Search in Modal */}
              <div className="p-3 border-b border-border bg-paper/50">
                <input
                  type="text"
                  value={tagModalSearch}
                  onChange={(e) => setTagModalSearch(e.target.value)}
                  placeholder="过滤标签名称..."
                  className="w-full text-xs rounded-lg border border-border bg-surface px-3 py-2 text-ink placeholder:text-text-muted focus:border-accent focus:outline-none"
                />
              </div>

              {/* Tags Grid */}
              <div className="p-4 overflow-y-auto space-y-2 flex-1">
                <div className="flex flex-wrap gap-2">
                  {filteredModalTags.map((tag) => {
                    const isSelected = selectedTag === tag.name;
                    return (
                      <button
                        key={tag.name}
                        onClick={() => {
                          setSelectedTag(isSelected ? null : tag.name);
                          setShowTagModal(false);
                        }}
                        className={`text-xs px-2.5 py-1 rounded-lg transition flex items-center gap-1.5 ${
                          isSelected
                            ? "bg-accent text-white font-medium shadow-xs"
                            : "bg-surface border border-border text-ink/80 hover:border-accent hover:text-accent"
                        }`}
                      >
                        <span>#{tag.name}</span>
                        <span className={`text-[10px] ${isSelected ? "text-white/80" : "text-text-muted"}`}>
                          {tag.count}
                        </span>
                      </button>
                    );
                  })}
                  {filteredModalTags.length === 0 && (
                    <p className="text-xs text-text-muted py-6 w-full text-center">
                      未找到匹配的标签
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SearchResultCard({
  result,
  dynasty,
  currentLevel,
  onSetLevel,
  autoExpand,
  selectedTag,
  onSelectTag,
}: {
  result: SearchResult;
  dynasty: string;
  currentLevel: number;
  onSetLevel: (level: number) => void;
  autoExpand?: boolean;
  selectedTag?: string | null;
  onSelectTag?: (tag: string) => void;
}) {
  const [expanded, setExpanded] = useState(autoExpand ?? false);

  useEffect(() => {
    if (autoExpand) {
      setExpanded(true);
    }
  }, [autoExpand]);

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden transition hover:border-accent shadow-2xs">
      <div 
        className="px-4 py-3 cursor-pointer select-none flex justify-between items-start"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0 pr-3">
          <div className="font-semibold text-ink text-base">{result.poem.name}</div>
          <div className="text-xs text-text-muted mt-0.5">
            <span className="opacity-75">[{dynasty}]</span> <span className="ml-1 font-medium">{result.poem.author}</span>
          </div>

          {/* Tags Pills */}
          {result.poem.tags && result.poem.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {result.poem.tags.slice(0, 5).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTag?.(t);
                  }}
                  className={`text-[11px] px-2 py-0.5 rounded-md transition ${
                    selectedTag === t
                      ? "bg-accent text-white font-medium shadow-xs"
                      : "bg-paper border border-border/80 text-ink/70 hover:border-accent hover:text-accent active:scale-95"
                  }`}
                >
                  #{t}
                </button>
              ))}
            </div>
          )}

          {!expanded && result.poem.matchedLine && (
            <div className="mt-2 text-sm text-ink/80 line-clamp-1" dangerouslySetInnerHTML={{ __html: result.poem.matchedLine }} />
          )}
        </div>
        
        {/* Current Level Badge */}
        <div className="shrink-0 flex flex-col items-end">
          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${currentLevel > 1 ? 'bg-accent text-white shadow-xs' : 'bg-gray-200 text-gray-500'}`}>
            {currentLevel}
          </span>
          <span className="text-[10px] text-text-muted mt-1">{currentLevel > 1 ? '已学' : '未学'}</span>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border/50 pt-3">
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-text-muted">调整熟练度：</span>
            {([1, 2, 3, 4, 5] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={(e) => {
                  e.stopPropagation();
                  onSetLevel(lvl);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  currentLevel === lvl
                    ? "bg-accent text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {lvl}级
              </button>
            ))}
          </div>
          
          <div className="bg-paper/50 rounded-xl p-3.5 text-sm text-ink/90 space-y-1.5 leading-relaxed font-serif">
            {result.poem.content.map((line, i) => {
               const isMatched = i === result.poem.matchedLineIndex && result.poem.matchedLine.includes('『');
               return (
                 <div key={i} dangerouslySetInnerHTML={{ __html: isMatched ? result.poem.matchedLine : line }} />
               );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
