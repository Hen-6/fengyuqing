"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useUser } from "@/lib/userContext";
import { generalSearch, SearchResult } from "@/lib/meilisearch";
import { OnlinePoemCard } from "@/components/ui/OnlinePoemCard";
import { setLevel } from "@/lib/srs";
import { loadAllPoemsLookup, getPoemByKeyFast } from "@/data/allPoemsLookup";

export default function SearchPage() {
  const { store, loaded, upsertPoemProgress, deletePoemProgress } = useUser();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [allLoaded, setAllLoaded] = useState(false);

  const [visibleCount, setVisibleCount] = useState(40);

  useEffect(() => {
    loadAllPoemsLookup().then(() => setAllLoaded(true));
  }, []);

  // Debounce input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 400);
    return () => clearTimeout(handler);
  }, [query]);

  // Execute search
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q) {
      setResults([]);
      return;
    }

    let isMounted = true;
    setSearching(true);
    generalSearch(q, 2000)
      .then((res) => {
        if (isMounted) {
          setResults(res);
          setVisibleCount(40); // Reset count on new query
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
  }, [debouncedQuery]);

  if (!loaded) return null;

  return (
    <div className="min-h-screen paper-texture px-6 py-8">
      <div className="mx-auto max-w-md space-y-6">
        <header className="flex items-center gap-4">
          <Link href="/" className="text-2xl text-text-muted hover:text-accent transition">←</Link>
          <h1 className="text-xl font-bold text-ink">搜索诗词</h1>
        </header>

        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索作者、标题或诗句..."
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 pl-10 text-ink placeholder:text-text-muted focus:border-accent focus:outline-none transition"
            autoFocus
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">🔍</span>
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted animate-pulse">
              搜索中...
            </span>
          )}
        </div>

        {debouncedQuery.trim() && !searching && results.length === 0 && (
          <p className="text-center text-text-muted py-8 text-sm">
            未找到包含「{debouncedQuery}」的诗词
          </p>
        )}

        <div className="space-y-4">
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

        {results.length > visibleCount && (
          <div className="pt-4 text-center">
            <button
              onClick={() => setVisibleCount((prev) => prev + 100)}
              className="px-6 py-2.5 rounded-xl border border-border bg-surface text-sm font-medium text-ink hover:border-accent hover:text-accent transition shadow-sm active:scale-95"
            >
              加载更多诗词 (已显示 {Math.min(visibleCount, results.length)}/{results.length})
            </button>
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
}: {
  result: SearchResult;
  dynasty: string;
  currentLevel: number;
  onSetLevel: (level: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden transition hover:border-accent">
      <div 
        className="px-4 py-3 cursor-pointer select-none flex justify-between items-start"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <div className="font-medium text-ink">{result.poem.name}</div>
          <div className="text-xs text-text-muted mt-0.5">
            <span className="opacity-70">[{dynasty}]</span> <span className="ml-1">{result.poem.author}</span>
          </div>
          {!expanded && result.poem.matchedLine && (
            <div className="mt-2 text-sm text-ink opacity-80 line-clamp-1" dangerouslySetInnerHTML={{ __html: result.poem.matchedLine }} />
          )}
        </div>
        
        {/* Current Level Badge */}
        <div className="shrink-0 ml-4 flex flex-col items-end">
          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${currentLevel > 1 ? 'bg-accent text-white' : 'bg-gray-200 text-gray-500'}`}>
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
                className={`px-2 py-1 rounded text-xs font-medium transition ${
                  currentLevel === lvl
                    ? "bg-accent text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {lvl}级
              </button>
            ))}
          </div>
          
          <div className="bg-paper/50 rounded p-3 text-sm text-ink/90 space-y-1">
            {result.poem.content.map((line, i) => {
               // Only highlight exact match if we want, but since generalSearch might not have highlight HTML in all lines, we just render raw string or matched line if it's the highlighted one.
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
