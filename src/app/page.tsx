"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadStore } from "@/lib/user";
import { FamiliarityChart } from "@/components/ui/FamiliarityChart";

export default function HomePage() {
  const [ready, setReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    const store = loadStore();
    if (!store.initialized || !store.assessmentDone) {
      setNeedsOnboarding(true);
    }
    setReady(true);
  }, []);

  if (!ready) return null;

  const games = [
    {
      href: "/games/feihua/",
      emoji: "🌸",
      title: "飞花令",
      desc: "选一个字，接出含该字的诗句",
      tag: "入门",
      color: "bg-rose-50 border-rose-200 hover:border-rose-400",
    },
    {
      href: "/games/jielong/",
      emoji: "🔗",
      title: "接龙",
      desc: "下一句末字 = 上一句末字",
      tag: "进阶",
      color: "bg-blue-50 border-blue-200 hover:border-blue-400",
    },
    {
      href: "/games/xunhua/",
      emoji: "🌺",
      title: "寻花令",
      desc: "100字提示格，猜出对句",
      tag: "挑战",
      color: "bg-amber-50 border-amber-200 hover:border-amber-400",
    },
  ];

  return (
    <div className="min-h-screen bg-bg px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-8">
        {/* Header */}
        <header className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-ink">风雨情</h1>
          <p className="mt-2 text-sm text-text-muted">古诗词练习平台</p>
        </header>

        {/* Onboarding banner */}
        {needsOnboarding && (
          <Link
            href="/onboarding/"
            className="flex items-center justify-between rounded-2xl border-2 border-accent bg-accent-light px-6 py-4 text-accent"
          >
            <div>
              <div className="font-semibold">欢迎来到风雨情！</div>
              <div className="text-sm opacity-80">完成3轮测评，开始学习</div>
            </div>
            <span className="text-2xl">→</span>
          </Link>
        )}

        {/* Familiarity overview */}
        <FamiliarityChart />

        {/* Game cards */}
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-text-muted">
            游戏
          </h2>
          <div className="space-y-3">
            {games.map((game) => (
              <Link
                key={game.href}
                href={game.href}
                className={`flex items-center gap-4 rounded-2xl border bg-surface p-5 shadow-sm transition ${game.color}`}
              >
                <span className="text-3xl">{game.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-ink">{game.title}</h3>
                    <span className="rounded-full border border-current px-2 py-0.5 text-xs text-text-muted">
                      {game.tag}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-text-muted">{game.desc}</p>
                </div>
                <span className="text-xl text-text-muted">›</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Daily */}
        <Link
          href="/daily/"
          className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:border-accent"
        >
          <span className="text-3xl">📜</span>
          <div>
            <h3 className="font-semibold text-ink">每日推荐</h3>
            <p className="text-sm text-text-muted">按知名度每日推进一首新诗</p>
          </div>
          <span className="ml-auto text-xl text-text-muted">›</span>
        </Link>

        {/* Progress */}
        <Link
          href="/progress/"
          className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:border-accent"
        >
          <span className="text-3xl">📊</span>
          <div>
            <h3 className="font-semibold text-ink">学习详情</h3>
            <p className="text-sm text-text-muted">查看所有诗词的掌握状态</p>
          </div>
          <span className="ml-auto text-xl text-text-muted">›</span>
        </Link>

        {/* Import / Export */}
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-text-muted">
            数据
          </h2>
          <div className="flex gap-3">
            <button
              onClick={() => {
                const { exportProgress, loadStore } = require("@/lib/user");
                const json = exportProgress(loadStore());
                const blob = new Blob([json], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "fengyuqing-progress.json";
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm text-text-muted hover:border-accent hover:text-accent transition"
            >
              导出进度
            </button>
            <ImportButton />
          </div>
        </section>
      </div>
    </div>
  );
}

function ImportButton() {
  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const { importProgress } = require("@/lib/user");
        const ok = importProgress(reader.result as string);
        if (ok) {
          window.location.reload();
        } else {
          alert("导入失败，文件格式错误");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <button
      onClick={handleImport}
      className="flex-1 rounded-xl border border-border py-2.5 text-sm text-text-muted hover:border-accent hover:text-accent transition"
    >
      导入进度
    </button>
  );
}
