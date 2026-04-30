"use client";

import { useState, useCallback } from "react";
import { OnlinePoemCard } from "@/components/ui/OnlinePoemCard";
import { VoiceInput } from "@/components/ui/VoiceInput";
import { LEVEL_LABELS } from "@/lib/srs";
import { OnlinePoemResult, searchOnline } from "@/lib/onlineSearch";
import { loadStore, markPoemAnswered, setLevel } from "@/lib/user";
import { stripPunctuation } from "@/lib/poems";

type Mode = "cross" | "same";

function getLastChar(s: string): string {
  const clean = stripPunctuation(s);
  return clean[clean.length - 1] || "";
}

function cleanLine(s: string): string {
  return stripPunctuation(s).trim();
}

export function JielongGame() {
  const [mode, setMode] = useState<Mode | null>(null);
  // 当前系统句（来自某首诗的某句）
  const [botLine, setBotLine] = useState<string>("");
  const [botPoem, setBotPoem] = useState<OnlinePoemResult | null>(null);
  const [botLastChar, setBotLastChar] = useState<string>("");
  const [userInput, setUserInput] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [onlineResult, setOnlineResult] = useState<OnlinePoemResult | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(3);
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [searching, setSearching] = useState(false);
  const store = loadStore();

  /** 开始游戏：在线搜索第一句 */
  const startGame = useCallback(async (m: Mode) => {
    setMode(m);
    setRound(1);
    setScore(0);
    setOnlineResult(null);
    setShowCard(false);
    setUserInput("");
    setFeedback(null);
    setSearching(true);

    // 随机选一个常见起始字
    const starts = ["月", "春", "花", "风", "秋", "雨", "山", "水", "夜", "天"];
    const startChar = starts[Math.floor(Math.random() * starts.length)];
    const hits = await searchOnline(startChar, 20);
    setSearching(false);

    if (hits.length === 0) {
      setFeedback({ ok: false, msg: "无法开始，请稍后再试" });
      setMode(null);
      return;
    }

    const pick = hits[Math.floor(Math.random() * hits.length)];
    const lines = pick.poem.content
      .map((l) => cleanLine(l))
      .filter((l) => l.length >= 4);
    if (lines.length === 0) {
      setFeedback({ ok: false, msg: "无法开始，请稍后再试" });
      setMode(null);
      return;
    }

    const firstLine = lines[Math.floor(Math.random() * lines.length)];
    setBotLine(firstLine);
    setBotPoem(pick.poem);
    setBotLastChar(firstLine[firstLine.length - 1]);
  }, []);

  /** 用户提交 */
  const submit = useCallback(async () => {
    if (!userInput.trim()) return;
    const trimmed = userInput.trim();
    const inputLast = trimmed[trimmed.length - 1];

    if (trimmed.length < 4) {
      setFeedback({ ok: false, msg: "诗句至少需要4个字" });
      return;
    }

    if (inputLast !== botLastChar) {
      setFeedback({ ok: false, msg: `末字「${inputLast}」≠ 上句末字「${botLastChar}」` });
      return;
    }

    setSearching(true);
    const hits = await searchOnline(trimmed, 5);
    setSearching(false);

    if (hits.length === 0) {
      setFeedback({ ok: false, msg: "诗句不在库中，请检查是否有错别字" });
      return;
    }

    // 正确
    const hit = hits[0];
    setOnlineResult(hit.poem);
    setScore((s) => s + 1);
    setFeedback({ ok: true, msg: "✓ 正确！" });
    markPoemAnswered(store, `${hit.poem.name.trim()}:${hit.poem.author.trim()}`);
    setShowCard(true);
  }, [userInput, botLastChar, store]);

  /** 下一轮：系统出用户刚才接的那句，用户接下一句 */
  const nextRound = useCallback(async () => {
    if (!onlineResult) return;

    setShowCard(false);
    setOnlineResult(null);
    setUserInput("");
    setFeedback(null);
    setRound((r) => r + 1);

    if (mode === "same") {
      // 同诗接龙：在同一首诗中找下一句
      const lines = onlineResult.content.map((l) => cleanLine(l)).filter((l) => l.length >= 4);
      // 找所有末字等于 botLastChar 的句子，再找它们的下一句
      let foundNext = false;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i][lines[i].length - 1] === botLastChar && i + 1 < lines.length) {
          const next = lines[i + 1];
          setBotLine(next);
          setBotPoem(onlineResult);
          setBotLastChar(next[next.length - 1]);
          foundNext = true;
          break;
        }
      }
      if (!foundNext) {
        // 找不到匹配的下一句，换一首
        setFeedback({ ok: false, msg: "这首诗没有更多可接的句子，换一首继续" });
        // 重新开始搜索新诗
        const hits = await searchOnline(botLastChar, 10);
        if (hits.length > 0) {
          const pick = hits[Math.floor(Math.random() * hits.length)];
          const nextLines = pick.poem.content.map((l) => cleanLine(l)).filter((l) => l.length >= 4);
          if (nextLines.length > 0) {
            const first = nextLines[Math.floor(Math.random() * nextLines.length)];
            setBotLine(first);
            setBotPoem(pick.poem);
            setBotLastChar(first[first.length - 1]);
          }
        }
      }
    } else {
      // 跨诗接龙：搜用户上一句末字开头的诗
      setSearching(true);
      const hits = await searchOnline(botLastChar, 10);
      setSearching(false);

      if (hits.length === 0) {
        setFeedback({ ok: false, msg: `没有找到含「${botLastChar}」的诗句，游戏结束` });
        setMode(null);
        return;
      }

      const pick = hits[Math.floor(Math.random() * hits.length)];
      const lines = pick.poem.content
        .map((l) => cleanLine(l))
        .filter((l) => l.length >= 4 && l[l.length - 1] === botLastChar);
      const candidates = lines.length > 0 ? lines : pick.poem.content.map((l) => cleanLine(l)).filter((l) => l.length >= 4);
      if (candidates.length === 0) {
        setFeedback({ ok: false, msg: "游戏结束" });
        setMode(null);
        return;
      }
      const first = candidates[Math.floor(Math.random() * candidates.length)];
      setBotLine(first);
      setBotPoem(pick.poem);
      setBotLastChar(first[first.length - 1]);
    }
  }, [onlineResult, mode, botLastChar]);

  const confirmLevel = useCallback(() => {
    if (onlineResult) {
      setLevel(
        store,
        `${onlineResult.name.trim()}:${onlineResult.author.trim()}`,
        selectedLevel
      );
    }
    nextRound();
  }, [onlineResult, selectedLevel, store, nextRound]);

  const reset = useCallback(() => {
    setMode(null);
    setBotLine("");
    setBotPoem(null);
    setBotLastChar("");
    setUserInput("");
    setFeedback(null);
    setOnlineResult(null);
    setShowCard(false);
    setRound(1);
    setScore(0);
  }, []);

  const submitVoice = useCallback((text: string) => {
    setUserInput(text);
  }, []);

  return (
    <div className="mx-auto max-w-lg">
      {/* 模式选择 */}
      {mode === null && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-ink">接龙</h2>
            <p className="mt-1 text-sm text-text-muted">下一句的末字须与上一句末字相同</p>
          </div>
          {searching && (
            <p className="text-center text-sm text-text-muted animate-pulse">在线加载中…</p>
          )}
          {!searching && (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => startGame("cross")}
                className="rounded-xl border border-border bg-surface py-4 text-left px-5 hover:border-accent transition"
              >
                <div className="font-semibold text-ink">跨诗接龙</div>
                <div className="text-sm text-text-muted">任意诗句接龙，更具挑战</div>
              </button>
              <button
                onClick={() => startGame("same")}
                className="rounded-xl border border-border bg-surface py-4 text-left px-5 hover:border-accent transition"
              >
                <div className="font-semibold text-ink">同诗接龙</div>
                <div className="text-sm text-text-muted">接同一首诗的下一句</div>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 游戏中 */}
      {mode !== null && (
        <div className="space-y-5">
          {searching && (
            <p className="text-center text-sm text-text-muted animate-pulse">在线搜索中…</p>
          )}

          <div className="flex justify-between text-xs text-text-muted">
            <span>第 {round} 轮</span>
            <span>正确：{score}</span>
          </div>

          {/* 系统出句 */}
          {botLine && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs text-text-muted mb-1">系统</p>
              <p className="text-lg text-ink">{botLine}</p>
              {botPoem && (
                <p className="mt-1 text-xs text-text-muted">
                  《{botPoem.name}》— {botPoem.author}
                </p>
              )}
            </div>
          )}

          {/* 末字提示 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-muted">请接（含</span>
            <span className="text-2xl font-bold text-accent">{botLastChar}</span>
            <span className="text-sm text-text-muted">字，≥4字）</span>
          </div>

          {/* 输入 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="输入诗句"
              className="input-chinese flex-1 text-center"
              autoFocus
            />
            <VoiceInput onResult={submitVoice} />
          </div>

          {feedback && (
            <p className={`text-center text-sm ${feedback.ok ? "text-correct" : "text-accent"}`}>
              {feedback.msg}
            </p>
          )}

          <div className="flex gap-3">
            {showCard ? (
              <>
                <button onClick={confirmLevel} className="btn-primary flex-1">
                  记录并继续
                </button>
                <button onClick={reset} className="btn-secondary">
                  结束
                </button>
              </>
            ) : (
              <>
                <button onClick={submit} className="btn-primary flex-1">
                  提交
                </button>
                <button onClick={reset} className="btn-secondary">
                  结束
                </button>
              </>
            )}
          </div>

          {/* 诗词卡 */}
          {showCard && onlineResult && (
            <OnlinePoemCard result={onlineResult} onClose={() => setShowCard(false)} />
          )}

          {/* 熟练度 */}
          {showCard && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="mb-3 text-center text-sm text-text-muted">你对这首诗的熟悉程度？</p>
              <div className="flex justify-center gap-2">
                {Object.entries(LEVEL_LABELS).map(([lvl, { name }]) => (
                  <button
                    key={lvl}
                    onClick={() => setSelectedLevel(Number(lvl))}
                    className={`
                      flex flex-col items-center rounded-lg border px-3 py-2 text-sm transition
                      ${selectedLevel === Number(lvl)
                        ? "border-accent bg-accent-light text-accent font-semibold"
                        : "border-border text-text-muted hover:border-accent"
                      }
                    `}
                  >
                    <span>{lvl}</span>
                    <span className="text-xs">{name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
