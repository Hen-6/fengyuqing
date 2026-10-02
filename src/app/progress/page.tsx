"use client";


function SyncDataButton() {
  const { store, upsertPoemProgress, deletePoemProgress } = useUser();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSync = async () => {
    if (!confirm("这将会根据最新 37 万题库重新匹配您所有已学诗词的名称。对于无法在题库中找到的诗词，将会彻底删除记录。是否继续？")) return;
    setSyncing(true);
    setResult("正在校验数据，请勿关闭页面...");
    
    let migrated = 0;
    let deleted = 0;
    
    const keys = Object.keys(store.poems);
    for (const key of keys) {
      if (/^[0-9a-f]{24}$/i.test(key)) continue; // ignore mongo ids? or maybe let them be deleted?
      // Actually, if it's an old mongo ID, getPoemByKeyExport will definitely return null and delete it.
      
      const res = await getPoemByKeyExport(key);
      if (!res) {
        deletePoemProgress(key);
        deleted++;
      } else {
        const newKey = `${res.poem.name.trim()}:${res.poem.author.trim()}`;
        if (newKey !== key) {
          const oldProg = store.poems[key];
          upsertPoemProgress(newKey, (prev) => {
              if (prev && prev.level > oldProg.level) return prev;
              return { ...oldProg };
          });
          deletePoemProgress(key);
          migrated++;
        }
      }
    }
    
    setResult(`同步完成！共迁移统一了 ${migrated} 首诗词名称，删除了 ${deleted} 首无法匹配的记录。`);
    setSyncing(false);
  };

  return (
    <div className="mt-8 rounded-xl border border-accent/20 bg-accent/5 p-4">
      <h3 className="font-semibold text-accent mb-2">统一诗词数据</h3>
      <p className="text-xs text-text-muted mb-4">
        如果您之前学习的诗词名称（如《相见欢》）与最新题库（如《望江南·多少恨》）不匹配，可点击下方按钮自动迁移。遇到无法匹配的条目将自动清除。
      </p>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="w-full btn-secondary text-sm py-2 disabled:opacity-50"
        style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
      >
        {syncing ? '正在统一数据...' : '严格统一我的诗词名称并清理无效记录'}
      </button>
      {result && <p className="mt-2 text-xs text-accent text-center">{result}</p>}
    </div>
  );
}

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/lib/userContext";
import { getRankList } from "@/lib/poems";
import { PoemProgress, setLevel } from "@/lib/srs";
import { LEVEL_LABELS } from "@/lib/srs";
import { OnlinePoemCard } from "@/components/ui/OnlinePoemCard";
import type { OnlinePoemResult } from "@/lib/localSearch";
import { getPoemByKeyExport } from "@/lib/dbSearch";
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
    setAllLoaded(true);
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

        <SyncDataButton />

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

  const handleClick = async () => {
    if (showCard) { setShowCard(false); return; }
    
    let found = getPoemByKeyFast(item.key);
    
    if (!found) {
      try {
        const res = await getPoemByKeyExport(item.key);
        if (res && res.poem) {
          found = {
            t: res.poem.name,
            a: res.poem.author,
            d: res.poem.dynasty,
            content: res.poem.content
          };
        }
      } catch (e) {
        console.error("Failed to fetch poem details from worker", e);
      }
    }
    
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
