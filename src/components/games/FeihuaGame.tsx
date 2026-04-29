"use client";

import { useState, useCallback } from "react";
import { OnlinePoemCard } from "@/components/ui/OnlinePoemCard";
import { CharPicker } from "@/components/ui/CharPicker";
import { VoiceInput } from "@/components/ui/VoiceInput";
import { OnlinePoemResult, searchOnline } from "@/lib/onlineSearch";
import { FEIHUA_CHARS } from "@/lib/poems";
import { useUser } from "@/lib/userContext";

interface BotPoem {
  poem: OnlinePoemResult;
  lineIndex: number;
  cleanLine: string; // 原诗句，含标点
}

export function FeihuaGame() {
  const { markPoemAnswered, setLevel } = useUser();
  const [selectedChar, setSelectedChar] = useState<string>("");
  const [phase, setPhase] = useState<"pick" | "playing">("pick");
  const [botPoem, setBotPoem] = useState<BotPoem | null>(null);
  const [userInput, setUserInput] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [onlineResult, setOnlineResult] = useState<OnlinePoemResult | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [showBotModal, setShowBotModal] = useState(false);
  const [similarPoems, setSimilarPoems] = useState<OnlinePoemResult[]>([]);
  const [searching, setSearching] = useState(false);

  /** 选一个字后，在线搜索含该字的诗，随机选一句 */
  const selectChar = useCallback(async (char: string) => {
    setSelectedChar(char);
    setOnlineResult(null);
    setSimilarPoems([]);
    setFeedback(null);
    setShowCard(false);
    setShowBotModal(false);
    setSearching(true);

    // 在线搜索含该字的诗
    const hits = await searchOnline(char, 20);
    setSearching(false);

    if (hits.length === 0) {
      setFeedback({ ok: false, msg: `没有找到含「${char}」的诗句` });
      setPhase("pick");
      return;
    }

    // 随机挑一首，再从其诗句中随机选一句
    const pick = hits[Math.floor(Math.random() * hits.length)];
    const lines = pick.poem.content.filter((l) => l.replace(/<[^>]+>/g, "").trim().length >= 4);
    if (lines.length === 0) {
      setFeedback({ ok: false, msg: "这首诗没有可用的句子" });
      return;
    }
    const lineIdx = Math.floor(Math.random() * lines.length);
    const rawLine = lines[lineIdx];

    setBotPoem({ poem: pick.poem, lineIndex: lineIdx, cleanLine: rawLine });
    setPhase("playing");
  }, []);

  const handleRandom = useCallback(() => {
    const char = FEIHUA_CHARS[Math.floor(Math.random() * FEIHUA_CHARS.length)];
    selectChar(char);
  }, [selectChar]);

  const submitText = useCallback(async (text: string) => {
    const input = text.trim();
    if (!input) return;
    if (input.length < 4) {
      setFeedback({ ok: false, msg: "请输入至少4个字" });
      return;
    }

    setSearching(true);
    const hits = await searchOnline(input, 5);
    setSearching(false);

    if (hits.length === 0) {
      setFeedback({ ok: false, msg: "诗句不在库中" });
      return;
    }

    // 第一个就是最匹配的
    const hit = hits[0];
    setSimilarPoems([]);
    setOnlineResult(hit.poem);
    setFeedback({ ok: true, msg: "✓ 正确！" });
    markPoemAnswered(hit.poem._id || `${hit.poem.name}:${hit.poem.author}`);
    setShowCard(true);
  }, []);

  const handleSubmit = useCallback(() => {
    submitText(userInput);
  }, [userInput, submitText]);

  const handleVoiceResult = useCallback((text: string) => {
    setUserInput(text);
    submitText(text);
  }, [submitText]);

  const handleNextForSameChar = useCallback(async () => {
    if (!selectedChar) return;
    await selectChar(selectedChar);
  }, [selectedChar, selectChar]);

  const handleSwitchChar = useCallback(() => {
    setSelectedChar("");
    setBotPoem(null);
    setUserInput("");
    setFeedback(null);
    setOnlineResult(null);
    setShowCard(false);
    setShowBotModal(false);
    setPhase("pick");
  }, []);

  const selectSimilarPoem = useCallback((poem: OnlinePoemResult) => {
    setSimilarPoems([]);
    setOnlineResult(poem);
    setFeedback({ ok: true, msg: "✓ 已选用该诗句" });
    markPoemAnswered(poem._id || `${poem.name}:${poem.author}`);
    setShowCard(true);
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

          <button onClick={handleRandom} className="btn-primary w-full">
            随机关键词开始
          </button>

          <div className="text-center text-xs text-text-muted">— 或 自选关键词 —</div>

          <CharPicker selected={selectedChar} onSelect={selectChar} />
        </div>
      )}

      {/* 游戏中 */}
      {phase === "playing" && (
        <div className="space-y-5">
          {searching && (
            <p className="text-center text-sm text-text-muted animate-pulse">
              在线搜索中…
            </p>
          )}

          {/* 当前关键字 */}
          <div className="text-center">
            <div className="text-xs text-text-muted mb-1">当前关键字</div>
            <div className="text-5xl font-bold text-accent">{selectedChar}</div>
            <div className="mt-1 flex justify-center gap-3 text-xs text-text-muted">
              <button onClick={handleRandom} className="underline hover:text-accent">随机换字</button>
              <span>·</span>
              <button onClick={handleSwitchChar} className="underline hover:text-accent">自选关键词</button>
            </div>
          </div>

          {/* 系统出句 */}
          {botPoem && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs text-text-muted mb-2">
                请接出含「{selectedChar}」的诗句
              </p>
              <div className="text-lg text-ink leading-relaxed">{botPoem.cleanLine}</div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-text-muted">
                  来自《{botPoem.poem.name}》— {botPoem.poem.author}
                </p>
                <button
                  onClick={() => setShowBotModal(true)}
                  className="text-xs text-accent hover:underline"
                >
                  查看全文
                </button>
              </div>

              {/* 系统诗熟练度自测 */}
              <div className="mt-3 rounded-lg border border-border bg-paper/60 p-3">
                <p className="mb-2 text-center text-xs text-text-muted">
                  你对这首诗的熟悉程度？
                </p>
                <div className="flex justify-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => {
                        setLevel(
                          botPoem!.poem._id || `${botPoem!.poem.name}:${botPoem!.poem.author}`,
                          lvl
                        );
                      }}
                      className="level-btn"
                    >
                      <span className="level-num">{lvl}</span>
                      <span className="level-name">
                        {["陌生", "认字", "识句", "成篇", "全知"][lvl - 1]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 系统诗词大弹窗 */}
          {showBotModal && botPoem && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowBotModal(false)} />
              <div className="relative z-10 w-full max-w-md">
                <OnlinePoemCard result={botPoem.poem} onClose={() => setShowBotModal(false)} />
              </div>
            </div>
          )}

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

              {feedback && !feedback.ok && (
                <p className="text-center text-sm text-accent">{feedback.msg}</p>
              )}

              {/* 相近诗词列表 */}
              {similarPoems.length > 0 && (
                <div className="rounded-xl border border-border bg-surface p-4">
                  <p className="mb-2 text-xs text-text-muted text-center">最相近的诗句：</p>
                  <div className="space-y-2">
                    {similarPoems.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => selectSimilarPoem(item)}
                        className="w-full text-left rounded-lg border border-border px-3 py-2 hover:border-accent hover:bg-accent-light transition-colors"
                      >
                        <div className="text-sm text-ink">
                          {item.content[item.matchedLineIndex] || item.matchedLine}
                        </div>
                        <div className="text-xs text-text-muted">
                          《{item.name}》— {item.author}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={handleSubmit} className="btn-primary w-full">
                提交
              </button>
            </>
          ) : (
            <>
              {onlineResult && (
                <div className="relative">
                  <button
                    onClick={() => setShowCard(false)}
                    className="absolute -top-1 right-0 text-xs text-text-muted hover:text-accent"
                  >
                    收起
                  </button>
                  <OnlinePoemCard result={onlineResult} />
                  <p className="mt-2 text-center text-xs text-text-muted">
                    ✓ 已记录为 Level 3
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={handleNextForSameChar} className="btn-primary flex-1">
                  继续
                </button>
                <button onClick={handleSwitchChar} className="btn-secondary">
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
