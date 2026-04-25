"use client";

import { useState, useCallback } from "react";
import { Poem } from "@/lib/poems";
import { getPoemById, getRandomLinesWithChar, verifyLineExists } from "@/lib/poems";
import { loadStore, markPoemAnswered, setLevel } from "@/lib/user";
import { PoemCard } from "@/components/ui/PoemCard";
import { CharPicker } from "@/components/ui/CharPicker";
import { VoiceInput } from "@/components/ui/VoiceInput";
import { LEVEL_LABELS } from "@/lib/srs";

export function FeihuaGame() {
  const [selectedChar, setSelectedChar] = useState<string>("");
  // "pick" | "playing"
  const [phase, setPhase] = useState<"pick" | "playing">("pick");

  // playing state
  const [botLine, setBotLine] = useState<{ poem: Poem; cleanLine: string } | null>(null);
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
  const [userInput, setUserInput] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [verifiedPoem, setVerifiedPoem] = useState<Poem | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(3);

  const store = loadStore();

  // Pick a new poem for the current character
  const pickNewPoem = useCallback((char: string, excludeIds: Set<string>): { poem: Poem; cleanLine: string } | null => {
    const options = getRandomLinesWithChar(char, 50);
    const available = options.filter(o => !excludeIds.has(o.poem.id));
    if (available.length === 0) {
      // All used up, reset
      return options.length > 0 ? options[Math.floor(Math.random() * options.length)] : null;
    }
    return available[Math.floor(Math.random() * available.length)];
  }, []);

  const selectChar = useCallback((char: string) => {
    setSelectedChar(char);
    setUsedIds(new Set());
    const pick = pickNewPoem(char, new Set());
    setBotLine(pick);
    setUserInput("");
    setFeedback(null);
    setVerifiedPoem(null);
    setShowCard(false);
    setPhase("playing");
  }, [pickNewPoem]);

  const submitText = useCallback((text: string) => {
    // 允许输入标点，不去除字符
    const input = text.trim();
    if (!input) return;

    // 至少2个字
    if (input.length < 2) {
      setFeedback({ ok: false, msg: "请输入至少2个字" });
      return;
    }

    const { found, poem } = verifyLineExists(input);
    if (!found) {
      setFeedback({ ok: false, msg: "诗句不在库中，请检查是否有错别字" });
      return;
    }

    // 正确
    setVerifiedPoem(poem);
    setFeedback({ ok: true, msg: "✓ 正确！" });
    if (poem) {
      markPoemAnswered(store, poem.id);
    }
    setShowCard(true);
  }, [store]);

  const handleSubmit = useCallback(() => {
    submitText(userInput);
  }, [userInput, submitText]);

  const handleVoiceResult = useCallback((text: string) => {
    setUserInput(text);
    submitText(text);
  }, [submitText]);

  const handleNextForSameChar = useCallback(() => {
    if (!selectedChar || !botLine) return;
    const newUsed = new Set(usedIds);
    newUsed.add(botLine.poem.id);
    setUsedIds(newUsed);

    const pick = pickNewPoem(selectedChar, newUsed);
    setBotLine(pick);
    setUserInput("");
    setFeedback(null);
    setVerifiedPoem(null);
    setShowCard(false);
    setSelectedLevel(3);
  }, [selectedChar, botLine, usedIds, pickNewPoem]);

  const handleConfirmLevel = useCallback(() => {
    if (verifiedPoem) {
      setLevel(store, verifiedPoem.id, selectedLevel);
    }
    handleNextForSameChar();
  }, [verifiedPoem, selectedLevel, store, handleNextForSameChar]);

  const handleSwitchChar = useCallback(() => {
    setSelectedChar("");
    setBotLine(null);
    setUserInput("");
    setFeedback(null);
    setVerifiedPoem(null);
    setShowCard(false);
    setPhase("pick");
  }, []);

  return (
    <div className="mx-auto max-w-lg">
      {/* 选字阶段 */}
      {phase === "pick" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-ink">飞花令</h2>
            <p className="mt-1 text-sm text-text-muted">
              选择一个字，任意接出含该字的诗句
            </p>
            <p className="mt-1 text-xs text-text-muted">
              无次数限制，考验诗词积累
            </p>
          </div>
          <CharPicker selected={selectedChar} onSelect={selectChar} />
        </div>
      )}

      {/* 游戏中 */}
      {phase === "playing" && botLine && (
        <div className="space-y-5">
          {/* 当前关键字 */}
          <div className="text-center">
            <div className="text-xs text-text-muted mb-1">当前关键字</div>
            <div className="text-5xl font-bold text-accent">{selectedChar}</div>
            <button
              onClick={handleSwitchChar}
              className="mt-2 text-xs text-text-muted underline hover:text-accent"
            >
              换字
            </button>
          </div>

          {/* 系统出句 */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-text-muted mb-1">请接出含「{selectedChar}」的诗句</p>
            <div className="text-lg text-ink leading-relaxed">{botLine.cleanLine}</div>
            <p className="mt-2 text-xs text-text-muted">
              来自《{botLine.poem.title}》— {botLine.poem.author}
            </p>
          </div>

          {/* 输入区 */}
          {!showCard ? (
            <>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder={`输入含「${selectedChar}」的诗句`}
                  className="input-chinese flex-1 text-center"
                  autoFocus
                />
                <VoiceInput onResult={handleVoiceResult} />
              </div>

              {feedback && (
                <p className={`text-center text-sm ${feedback.ok ? "text-[var(--correct)]" : "text-[var(--accent)]"}`}>
                  {feedback.msg}
                </p>
              )}

              <button
                onClick={handleSubmit}
                className="btn-primary w-full"
              >
                提交
              </button>
            </>
          ) : (
            <>
              {verifiedPoem && (
                <div className="relative">
                  <button
                    onClick={() => setShowCard(false)}
                    className="absolute -top-1 right-0 text-xs text-text-muted hover:text-accent"
                  >
                    收起
                  </button>
                  <PoemCard poem={verifiedPoem} />
                </div>
              )}

              {/* 熟练度自测 */}
              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="mb-3 text-center text-sm text-text-muted">
                  你对这首诗的熟悉程度？
                </p>
                <div className="flex justify-center gap-1.5">
                  {Object.entries(LEVEL_LABELS).map(([lvl, { name }]) => (
                    <button
                      key={lvl}
                      onClick={() => setSelectedLevel(Number(lvl))}
                      className={`level-btn ${selectedLevel === Number(lvl) ? "active" : ""}`}
                    >
                      <span className="level-num">{lvl}</span>
                      <span className="level-name">{name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleConfirmLevel}
                  className="btn-primary flex-1"
                >
                  记录并继续
                </button>
                <button
                  onClick={handleSwitchChar}
                  className="btn-secondary"
                >
                  换字
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
