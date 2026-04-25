"use client";

import { useState, useCallback, useRef } from "react";
import { getPoemById, getRandomLinesWithChar, verifyLineExists, Poem } from "@/lib/poems";
import { loadStore, markPoemAnswered } from "@/lib/user";
import { PoemCard } from "@/components/ui/PoemCard";
import { VoiceInput } from "@/components/ui/VoiceInput";
import { LEVEL_LABELS } from "@/lib/srs";

type Mode = "cross" | "same";

interface JielongGameProps {
  poems?: Poem[];
}

export function JielongGame({ poems }: JielongGameProps) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [botLine, setBotLine] = useState<{ poem: Poem; cleanLine: string } | null>(null);
  const [botLastChar, setBotLastChar] = useState<string>("");
  const [userInput, setUserInput] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [verifiedPoem, setVerifiedPoem] = useState<Poem | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(3);
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const store = loadStore();

  const lastChar = useRef<string>("");

  const startGame = useCallback((m: Mode) => {
    setMode(m);
    setRound(1);
    setScore(0);
    // 系统先出一句（随机）
    const couplets = getRandomLinesWithChar("月", 50);
    const pick = couplets[Math.floor(Math.random() * couplets.length)];
    setBotLine({ poem: pick.poem, cleanLine: pick.cleanLine });
    lastChar.current = pick.cleanLine[pick.cleanLine.length - 1];
    setBotLastChar(lastChar.current);
  }, []);

  const submit = useCallback(() => {
    if (!userInput.trim()) return;
    const trimmed = userInput.trim();

    if (trimmed.length < 4) {
      setFeedback({ ok: false, msg: "诗句至少需要4个字" });
      return;
    }

    const inputLastChar = trimmed[trimmed.length - 1];
    if (inputLastChar !== lastChar.current) {
      setFeedback({ ok: false, msg: `末字「${inputLastChar}」≠ 上句末字「${lastChar.current}」` });
      return;
    }

    const { found, poem } = verifyLineExists(trimmed);
    if (!found) {
      setFeedback({ ok: false, msg: "诗句不在库中，请检查是否有错别字" });
      return;
    }

    // 正确
    setVerifiedPoem(poem);
    setScore((s) => s + 1);
    setFeedback({ ok: true, msg: "✓ 正确！" });
    if (poem) markPoemAnswered(store, poem.id);
    setShowCard(true);
    lastChar.current = inputLastChar;
    setBotLastChar(inputLastChar);
  }, [userInput, store]);

  const nextRound = useCallback(() => {
    setShowCard(false);
    setUserInput("");
    setFeedback(null);
    setVerifiedPoem(null);
    setRound((r) => r + 1);
    // 系统从含 lastChar 的诗句中选下一句
    const options = getRandomLinesWithChar(lastChar.current, 30);
    if (options.length === 0) {
      setFeedback({ ok: false, msg: `没有找到含「${lastChar.current}」的下一句，游戏结束` });
      setMode(null);
      return;
    }
    const pick = options[Math.floor(Math.random() * options.length)];
    setBotLine({ poem: pick.poem, cleanLine: pick.cleanLine });
  }, []);

  const confirmLevel = useCallback(() => {
    if (verifiedPoem) {
      const { setLevel } = require("@/lib/user");
      setLevel(store, verifiedPoem.id, selectedLevel);
    }
    nextRound();
  }, [verifiedPoem, selectedLevel, store, nextRound]);

  const reset = useCallback(() => {
    setMode(null);
    setBotLine(null);
    setUserInput("");
    setFeedback(null);
    setVerifiedPoem(null);
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
        </div>
      )}

      {/* 游戏中 */}
      {mode !== null && botLine && (
        <div className="space-y-5">
          <div className="flex justify-between text-xs text-text-muted">
            <span>第 {round} 轮</span>
            <span>正确：{score}</span>
          </div>

          {/* 系统出句 */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-text-muted mb-1">系统</p>
            <p className="text-lg text-ink">{botLine.cleanLine}</p>
            <p className="mt-1 text-xs text-text-muted">
              《{botLine.poem.title}》— {botLine.poem.author}
            </p>
          </div>

          {/* 末字提示 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-muted">请接（含</span>
            <span className="text-2xl font-bold text-accent">{lastChar.current}</span>
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
                <button
                  onClick={confirmLevel}
                  className="btn-primary flex-1"
                >
                  记录并继续
                </button>
                <button
                  onClick={reset}
                  className="btn-secondary"
                >
                  结束
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={submit}
                  className="btn-primary flex-1"
                >
                  提交
                </button>
                <button
                  onClick={reset}
                  className="btn-secondary"
                >
                  结束
                </button>
              </>
            )}
          </div>

          {/* 诗词卡 */}
          {showCard && verifiedPoem && (
            <PoemCard poem={verifiedPoem} onClose={() => setShowCard(false)} />
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
