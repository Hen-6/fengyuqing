"use client";

import Link from "next/link";
import { loadStore } from "@/lib/user";
import { FamiliarityChart } from "@/components/ui/FamiliarityChart";
import { useEffect, useState } from "react";

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
      desc: "选一个字，积累诗词底蕴，不限对答次数",
      tag: "入门",
    },
    {
      href: "/games/jielong/",
      emoji: "🔗",
      title: "接龙",
      desc: "末字相接，续出诗句（≥4字）",
      tag: "进阶",
    },
    {
      href: "/games/xunhua/",
      emoji: "🌺",
      title: "寻花令",
      desc: "100字提示格，猜出五言/七言对句",
      tag: "挑战",
    },
  ];

  return (
    <div className="min-h-screen paper-texture">
      {/* 顶部标题 */}
      <div className="pt-10 pb-4 text-center">
        <div className="inline-flex items-center gap-3">
          <span className="text-text-muted text-base">☘</span>
          <h1 className="text-4xl font-bold tracking-tight text-ink" style={{ fontFamily: "var(--font-sans)" }}>
            风雨情
          </h1>
          <span className="text-text-muted text-base">☘</span>
        </div>
        <p className="mt-1 text-sm text-text-muted tracking-widest">古诗词练习平台</p>
        <div className="mt-3 mx-auto max-w-xs h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      <div className="mx-auto max-w-2xl px-6 pb-12 space-y-5">

        {/* 引言 */}
        <div className="text-center py-1">
          <p className="text-sm text-text-muted italic" style={{ fontStyle: "italic" }}>
            「风雨无情，诗词有心」
          </p>
        </div>

        {/* 引导横幅 */}
        {needsOnboarding && (
          <Link
            href="/onboarding/"
            className="flex items-center justify-between rounded-2xl border-2 border-accent bg-accent-light px-6 py-4 text-accent hover:bg-red-50 transition-colors"
          >
            <div>
              <div className="font-semibold">欢迎来到风雨情！</div>
              <div className="text-sm opacity-80">完成3轮测评，了解你的诗词基础</div>
            </div>
            <span className="text-2xl">→</span>
          </Link>
        )}

        {/* 学习进度 */}
        <FamiliarityChart />

        {/* 游戏入口 */}
        <section>
          <div className="title-decoration">
            <span className="text-xs text-text-muted tracking-widest">游 戏</span>
          </div>
          <div className="space-y-3">
            {games.map((game) => (
              <Link
                key={game.href}
                href={game.href}
                className="guofeng-card flex items-center gap-4 p-5 hover:border-accent transition-colors"
              >
                <span className="text-3xl">{game.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-ink">{game.title}</h3>
                    <span className="stamp">{game.tag}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-text-muted">{game.desc}</p>
                </div>
                <span className="text-xl text-text-muted">›</span>
              </Link>
            ))}
          </div>
        </section>

        <hr className="section-divider" />

        {/* 每日推荐 */}
        <Link
          href="/daily/"
          className="guofeng-card flex items-center gap-4 p-5 hover:border-accent transition-colors"
        >
          <span className="text-3xl">📜</span>
          <div>
            <h3 className="font-semibold text-ink">每日推荐</h3>
            <p className="text-sm text-text-muted">按知名度每日推进一首新诗</p>
          </div>
          <span className="ml-auto text-xl text-text-muted">›</span>
        </Link>

        {/* 学习详情 */}
        <Link
          href="/progress/"
          className="guofeng-card flex items-center gap-4 p-5 hover:border-accent transition-colors"
        >
          <span className="text-3xl">📊</span>
          <div>
            <h3 className="font-semibold text-ink">学习详情</h3>
            <p className="text-sm text-text-muted">查看所有诗词的掌握状态</p>
          </div>
          <span className="ml-auto text-xl text-text-muted">›</span>
        </Link>

        <hr className="section-divider" />

        {/* 数据管理 */}
        <section className="guofeng-card p-5">
          <div className="title-decoration">
            <span className="text-xs text-text-muted tracking-widest">数 据</span>
          </div>
          <div className="flex gap-3 mt-3">
            <button
              onClick={() => {
                const { exportProgress, loadStore: ls } = require("@/lib/user");
                const json = exportProgress(ls());
                const blob = new Blob([json], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "fengyuqing-progress.json";
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="btn-secondary flex-1"
            >
              导出进度
            </button>
            <ImportButton />
          </div>
        </section>

        {/* 底部 */}
        <div className="text-center text-xs text-text-muted pt-4 pb-2">
          <p>风雨无情，诗词有心</p>
          <p className="mt-1 opacity-60">风雨情 · 古诗词练习平台</p>
        </div>
      </div>
    </div>
  );
}

function ImportButton() {
  return (
    <button
      onClick={() => {
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
      }}
      className="btn-secondary flex-1"
    >
      导入进度
    </button>
  );
}
