"use client";

import { useState, useCallback } from "react";
import { Poem } from "@/lib/poems";
import { getPoemById, getRandomLinesWithChar, verifyLineExists } from "@/lib/poems";
import { loadStore, setPoemProgress, markPoemAnswered, setLevel } from "@/lib/user";
import { PoemCard } from "@/components/ui/PoemCard";
import { CharPicker } from "@/components/ui/CharPicker";
import { VoiceInput } from "@/components/ui/VoiceInput";
import { LEVEL_LABELS } from "@/lib/srs";

interface FeihuaGameProps {
  poemPool?: Poem[];
}

export function FeihuaGame({ poemPool }: FeihuaGameProps) {
  const [phase, setPhase] = useState<"pick" | "answer" | "result">("pick");
  const [selectedChar, setSelectedChar] = useState<string>("");
  const [botLine, setBotLine] = useState<{ poem: Poem; cleanLine: string } | null>(null);
  const [userInput, setUserInput] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [verifiedPoem, setVerifiedPoem] = useState<Poem | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(3);
  const store = loadStore();

  const startGame = useCallback((char: string) => {
    setSelectedChar(char);
    setFeedback(null);
    setUserInput("");
    const options = getRandomLinesWithChar(char, 20);
    if (options.length === 0) {
      setFeedback({ ok: false, msg: `没有找到含「${char}」的诗句` });
      setPhase("pick");
      return;
    }
    const pick = options[Math.floor(Math.random() * options.length)];
    setBotLine({ poem: pick.poem, cleanLine: pick.cleanLine });
    setPhase("answer");
  }, []);

  const submit = useCallback(() => {
    if (!userInput.trim()) return;
    const trimmed = userInput.trim();
    if (trimmed.length < 4) {
      setFeedback({ ok: false, msg: "诗句至少需要4个字" });
      return;
    }

    const { found, poem } = verifyLineExists(trimmed);
    if (!found) {
      setFeedback({ ok: false, msg: "诗句不在库中，请检查是否有错别字" });
      return;
    }

    // 正确
    const { poem: matchedPoem } = verifyLineExists(trimmed);
    setVerifiedPoem(matchedPoem ?? null);
    setFeedback({ ok: true, msg: "✓ 正确！" });
    // 自动升级到 level 3
    if (matchedPoem) {
      markPoemAnswered(store, matchedPoem.id);
    }
    setPhase("result");
    setShowCard(true);
  }, [userInput, store]);

  const submitVoice = useCallback((text: string) => {
    setUserInput(text);
  }, []);

  const confirmLevel = useCallback(() => {
    if (verifiedPoem) {
      setLevel(store, verifiedPoem.id, selectedLevel);
    }
    setShowCard(false);
    setPhase("pick");
    setUserInput("");
    setFeedback(null);
    setVerifiedPoem(null);
  }, [verifiedPoem, selectedLevel, store]);

  const reset = useCallback(() => {
    setPhase("pick");
    setSelectedChar("");
    setBotLine(null);
    setUserInput("");
    setFeedback(null);
    setVerifiedPoem(null);
    setShowCard(false);
  }, []);

  return (
    <div className="mx-auto max-w-lg">
      {/* 选字阶段 */}
      {phase === "pick" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-ink">飞花令</h2>
            <p className="mt-1 text-sm text-text-muted">选择一个关键字，然后接出含该字的诗句</p>
          </div>
          <CharPicker selected={selectedChar} onSelect={startGame} />
          {feedback && !feedback.ok && (
            <p className="text-center text-sm text-accent">{feedback.msg}</p>
          )}
        </div>
      )}

      {/* 答题阶段 */}
      {phase === "answer" && botLine && (
        <div className="space-y-5">
          <div className="text-center">
            <div className="mb-3 text-5xl font-bold text-accent">{selectedChar}</div>
            <div className="rounded-xl border border-border bg-surface p-4 text-lg text-ink">
              {botLine.cleanLine}
            </div>
            <p className="mt-2 text-xs text-text-muted">
              来自《{botLine.poem.title}》— {botLine.poem.author}
            </p>
          </div>

          {/* 输入区 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={`请输入含「${selectedChar}」的诗句（至少4字）`}
              className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-lg text-ink
                         placeholder:text-text-muted focus:border-accent focus:outline-none"
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
            <button
              onClick={submit}
              className="flex-1 rounded-xl bg-accent py-3 text-white font-semibold hover:bg-red-700 transition"
            >
              提交
            </button>
            <button
              onClick={reset}
              className="rounded-xl border border-border px-4 py-3 text-text-muted hover:border-accent hover:text-accent transition"
            >
              换字
            </button>
          </div>
        </div>
      )}

      {/* 结果阶段 */}
      {phase === "result" && (
        <div className="space-y-5">
          <p className="text-center text-lg font-semibold text-correct">✓ 正确！</p>

          {showCard && verifiedPoem && (
            <PoemCard poem={verifiedPoem} onClose={() => setShowCard(false)} />
          )}

          {/* 熟练度自测 */}
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

          <div className="flex gap-3">
            <button
              onClick={confirmLevel}
              className="flex-1 rounded-xl bg-accent py-3 text-white font-semibold hover:bg-red-700 transition"
            >
              记录并继续
            </button>
            <button
              onClick={reset}
              className="rounded-xl border border-border px-4 py-3 text-text-muted hover:border-accent hover:text-accent transition"
            >
              返回
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
