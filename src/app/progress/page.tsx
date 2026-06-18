"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/lib/userContext";
import { getRankList } from "@/lib/poems";
import { PoemProgress, setLevel } from "@/lib/srs";
import { LEVEL_LABELS } from "@/lib/srs";
import { OnlinePoemCard } from "@/components/ui/OnlinePoemCard";
import type { OnlinePoemResult } from "@/lib/localSearch";
import { loadAllPoemsLookup, getPoemByKeyFast } from "@/data/allPoemsLookup";

const OBJECTID_RE = /^[0-9a-f]{24}$/i;
export default function ProgressPage() {
  const { store, loaded, upsertPoemProgress, deletePoemProgress } = useUser();
  const [rankMap, setRankMap] = useState<Map<string, { t: string; a: string; d: string }>>(new Map());
  const [allLoaded, setAllLoaded] = useState(false);

  useEffect(() => {
    const list = getRankList();
    const map = new Map<string, { t: string; a: string; d: string }>();
    for (const p of list) {
      map.set(`${p.t}:${p.a}`, { t: p.t, a: p.a, d: p.d });
    }
    setRankMap(map);
  }, []);

  useEffect(() => {
    loadAllPoemsLookup().then(() => setAllLoaded(true));
  }, []);

  if (!loaded) return null;

  const practiced = Object.values(store.poems).filter(
    (p) => !OBJECTID_RE.test(p.poemId) && p.level > 1
  );

  type PoemEntry = { key: string; title: string; author: string; dynasty: string; p: PoemProgress };
  const byLevel: Record<string, PoemEntry[]> = {
    "2": [], "3": [], "4": [], "5": [],
  };

  for (const prog of practiced) {
    const info = rankMap.get(prog.poemId);
    const lookup = allLoaded ? getPoemByKeyFast(prog.poemId) : null;
    
    const parts = prog.poemId.split(":");
    const t = info?.t || lookup?.t || parts[0] || prog.poemId;
    const a = info?.a || lookup?.a || parts.slice(1).join(":") || "";
    const d = info?.d || lookup?.d || "未知";

    const lvl = String(prog.level) as "2" | "3" | "4" | "5";
    if (!byLevel[lvl]) byLevel[lvl] = [];
    byLevel[lvl].push({
      key: prog.poemId,
      title: t,
      author: a,
      dynasty: d,
      p: prog,
    });
  }

  for (const lvl of Object.keys(byLevel)) {
    byLevel[lvl].sort((a, b) => a.title.localeCompare(b.title));
  }

  return (
    <div className="min-h-screen paper-texture px-6 py-8">
      <div className="mx-auto max-w-md space-y-6">
        <header className="flex items-center gap-4">
          <Link href="/" className="text-2xl text-text-muted hover:text-accent transition">←</Link>
          <h1 className="text-xl font-bold text-ink">学习详情</h1>
        </header>

        {[2, 3, 4, 5].map((lvl) => {
          const items = byLevel[String(lvl)] ?? [];
          if (items.length === 0) return null;
          const { name, desc } = LEVEL_LABELS[lvl as keyof typeof LEVEL_LABELS];
          return (
            <section key={lvl}>
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
                  {lvl}
                </span>
                <h2 className="font-semibold text-ink">{name}</h2>
                <span className="text-xs text-text-muted">— {desc}</span>
                <span className="ml-auto text-xs text-text-muted">{items.length}首</span>
              </div>
              <div className="space-y-1">
                {items.map((item) => (
                  <PoemEntryRow
                    key={item.key}
                    item={item}
                    p={item.p}
                    upsert={upsertPoemProgress}
                    onDelete={() => deletePoemProgress(item.key)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function PoemEntryRow({
  item,
  p,
  upsert,
  onDelete,
}: {
  item: { key: string; title: string; author: string; dynasty: string };
  p: PoemProgress;
  upsert: (poemId: string, updater: (prog: PoemProgress) => PoemProgress) => void;
  onDelete: () => void;
}) {
  const [showCard, setShowCard] = useState(false);
  const [poemData, setPoemData] = useState<{ t: string; a: string; d: string; content: string[] } | null>(null);
  const [localLevel, setLocalLevel] = useState(p.level);

  // 同步外部变化
  useEffect(() => { setLocalLevel(p.level); }, [p.level]);

  const handleClick = () => {
    if (showCard) { setShowCard(false); return; }
    const found = getPoemByKeyFast(item.key);
    setPoemData(found ?? null);
    setShowCard(true);
  };

  const handleSetLevel = (lvl: number) => {
    setLocalLevel(lvl);
    if (lvl === 1) {
      onDelete();
    } else {
      upsert(item.key, (prev) => setLevel(prev, lvl));
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="w-full flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-2.5 text-left hover:border-accent transition"
      >
        <div>
          <span className="font-medium text-ink">{item.title}</span>
        </div>
        <div className="text-xs text-text-muted">
          <span className="opacity-70">[{item.dynasty}]</span> <span className="ml-1">{item.author}</span>
        </div>
      </button>

      {showCard && (
        <div className="rounded-xl border border-border bg-surface p-4">
          {/* 熟练度调整 */}
          <div className="mb-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-text-muted">熟练度：</span>
            {([1, 2, 3, 4, 5] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => handleSetLevel(lvl)}
                className={`px-2 py-1 rounded text-xs font-medium transition ${
                  localLevel === lvl
                    ? "bg-accent text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {lvl}级
              </button>
            ))}
          </div>

          {poemData ? (
            <OnlinePoemCard
              highlightMatch={false}
              result={{
                _id: `${poemData.t}:${poemData.a}`,
                name: poemData.t,
                author: poemData.a,
                dynasty: poemData.d,
                content: poemData.content,
                note: "",
                matchedLine: poemData.content[0] ?? "",
                matchedLineIndex: 0,
              }}
            />
          ) : (
            <p className="text-center text-text-muted text-sm">未找到诗词内容</p>
          )}
        </div>
      )}
    </>
  );
}
