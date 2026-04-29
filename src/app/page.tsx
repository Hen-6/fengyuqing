"use client";

import Link from "next/link";
import { exportProgress, importProgress, loadStore } from "@/lib/user";
import { FamiliarityChart } from "@/components/ui/FamiliarityChart";
import { useLogin } from "@/lib/login";
export default function HomePage() {
  const store = loadStore();
  const { uuid, discordId, copyUUID, copied } = useLogin();

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
    <div className="glass-panel">
      {/* 顶部标题 */}
      <div className="pt-10 pb-4 text-center">
        <h1 className="text-5xl font-bold tracking-wide text-ink brush-title">
          风雨情
        </h1>
        <p className="mt-1 text-sm text-text-muted tracking-widest">古诗词练习平台</p>
      </div>

      <div className="mx-auto max-w-2xl px-6 pb-12 space-y-5">

        {/* 引言 */}
        <div className="text-center py-1">
          <p className="text-sm text-text-muted italic">
            「归去，也无风雨也无晴」
          </p>
        </div>

        {/* 学习进度 */}
        <FamiliarityChart />

        {/* Discord 绑定 */}
        {!discordId && (
          <div className="rounded-2xl border border-present bg-present/10 p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🔗</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink">绑定 Discord 账号</p>
                <p className="mt-1 text-xs text-text-muted">
                  将诗词进度同步到 Discord 机器人
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-paper px-2 py-1 text-xs text-ink">
                    {uuid || "加载中…"}
                  </code>
                  <button
                    onClick={copyUUID}
                    className="shrink-0 rounded bg-present px-2 py-1 text-xs text-white"
                  >
                    {copied ? "已复制 ✓" : "复制"}
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-text-muted">
                  复制 UUID，然后在 Discord 发送&nbsp;
                  <code className="rounded bg-paper px-1 text-xs">/绑定 &lt;粘贴UUID&gt;</code>
                </p>
              </div>
            </div>
          </div>
        )}

        {discordId && (
          <div className="rounded-2xl border border-correct bg-correct/10 p-4 text-center">
            <p className="text-sm text-correct">✅ Discord 账号已绑定</p>
            <p className="mt-1 text-xs text-text-muted">诗词进度已与 Discord 同步</p>
          </div>
        )}

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

        {/* 数据管理 */}
        <section className="guofeng-card p-5">
          <div className="title-decoration">
            <span className="text-xs text-text-muted tracking-widest">数 据</span>
          </div>
          <div className="flex gap-3 mt-3">
            <button
              onClick={() => {
                const json = exportProgress(store);
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
          </div>
        </section>

        {/* 底部 */}
        <div className="text-center text-xs text-text-muted pt-4 pb-2">
          <p>归去，也无风雨也无晴</p>
          <p className="mt-1 opacity-60">风雨情 · 古诗词练习平台</p>
        </div>
      </div>
    </div>
  );
}
