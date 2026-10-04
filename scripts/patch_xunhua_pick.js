const fs = require('fs');

let content = fs.readFileSync('src/components/games/XunhuaGame.tsx', 'utf8');

// Add CharPicker import
if (!content.includes('CharPicker')) {
    content = content.replace(
        'import { OnlinePoemResult, searchOnline, getPoemByKeyExport, SearchResult } from "@/lib/localSearch";',
        `import { OnlinePoemResult, searchOnline, getPoemByKeyExport, SearchResult, searchByChar } from "@/lib/localSearch";\nimport { CharPicker } from "@/components/ui/CharPicker";`
    );
}

// Change GamePhase definition
content = content.replace(
    'type GamePhase = "playing" | "won" | "lost";',
    'type GamePhase = "pick" | "playing" | "won" | "lost";'
);

// Change initial phase
content = content.replace(
    'const [phase, setPhase] = useState<GamePhase>("playing");',
    `const [phase, setPhase] = useState<GamePhase>("pick");
  const [selectedChar, setSelectedChar] = useState("");
  const [customChar, setCustomChar] = useState("");
  const [matchType, setMatchType] = useState<'exact'|'scattered'>('exact');
  const [feedback, setFeedback] = useState<{ok: boolean, msg: string} | null>(null);`
);

// Adjust fetchNextCoupletAndGrid signature
content = content.replace(
    'const fetchNextCoupletAndGrid = useCallback(async (keys: string[]): Promise<{ target: Couplet; hintGrid: string[] } | null> => {',
    `const fetchNextCoupletAndGrid = useCallback(async (keys: string[], keyword?: {char: string, type: 'exact'|'scattered'}): Promise<{ target: Couplet; hintGrid: string[] } | null> => {`
);

// We need to inject the logic to filter by keyword.
// Let's rewrite startRound to accept an optional keyword.
const startRoundRegex = /const startRound = useCallback\(async \(\) => \{[\s\S]*?setLoadingTarget\(false\);\n    \}\n  \}, \[store\.poems, prefetchedNext, fetchNextCoupletAndGrid, triggerPrefetch\]\);/;

const newStartRound = `const startRound = useCallback(async (keyword?: {char: string, type: 'exact'|'scattered'}) => {
    let knownKeys = Object.keys(store.poems).filter((k) => store.poems[k].level >= 1);

    if (keyword) {
      setLoadingTarget(true);
      const hits = await searchByChar(keyword.char, 1000, keyword.type);
      const hitKeys = new Set(hits.map(h => \`\${h.t}:\${h.a}\`));
      const intersected = knownKeys.filter(k => hitKeys.has(k));
      if (intersected.length > 0) {
        knownKeys = intersected;
      } else {
        // Fallback to global if local has no matches
        knownKeys = Array.from(hitKeys);
      }
      if (knownKeys.length === 0) {
        setFeedback({ ok: false, msg: "未找到包含该关键字的对句诗词" });
        setLoadingTarget(false);
        return;
      }
    } else if (knownKeys.length === 0) {
      knownKeys = [
        "静夜思:李白",
        "登鹳雀楼:王之涣",
        "春晓:孟浩然",
        "江雪:柳宗元",
        "鹿柴:王维",
        "相思:王维",
        "悯农（之二）:李绅",
        "寻隐者不遇:贾岛"
      ];
      setIsDemoMode(true);
    } else {
      setIsDemoMode(false);
    }

    setPhase("playing");
    setGuesses([]);
    setInput("");
    setMessage("");
    setRemaining(MAX_GUESSES);
    setRoundScore(0);
    setSkipped(false);

    // If there's a keyword, we skip prefetch cache to ensure it matches the keyword
    if (prefetchedNext && !keyword) {
      setTarget(prefetchedNext.target);
      setHintGrid(prefetchedNext.hintGrid);
      scoredCharsRef.current = new Set();
      hintCharsRef.current = new Set(prefetchedNext.target.text.split(""));
      setPrefetchedNext(null);
      triggerPrefetch(knownKeys);
      return;
    }

    setLoadingTarget(true);
    setError("");

    try {
      const result = await fetchNextCoupletAndGrid(knownKeys);
      if (!result) {
        if (keyword) {
          setPhase("pick");
          setFeedback({ ok: false, msg: "找到的诗词中没有符合 5/7 言格式的对句" });
        } else {
          setError("无法从您已学的诗词中提取出符合 5/7 言格式的对句。");
        }
        setLoadingTarget(false);
        return;
      }

      setTarget(result.target);
      setHintGrid(result.hintGrid);
      scoredCharsRef.current = new Set();
      hintCharsRef.current = new Set(result.target.text.split(""));

      if (!keyword) triggerPrefetch(knownKeys);
    } catch (e) {
      console.error(e);
      setError("加载对句失败，请重试。");
    } finally {
      setLoadingTarget(false);
    }
  }, [store.poems, prefetchedNext, fetchNextCoupletAndGrid, triggerPrefetch]);

  const selectChar = useCallback((char: string, type: 'exact'|'scattered' = 'exact') => {
    setSelectedChar(char);
    setFeedback(null);
    startRound({ char, type });
  }, [startRound]);

  const handleRandom = useCallback(() => {
    setSelectedChar("");
    setFeedback(null);
    startRound();
  }, [startRound]);`;

content = content.replace(startRoundRegex, newStartRound);

// Remove the auto-start useEffect if phase is pick
content = content.replace(
    /useEffect\(\(\) => \{\n    if \(userLoaded && !target && !loadingTarget && !error\) \{\n      startRound\(\);\n    \}\n  \/\/ eslint-disable-next-line react-hooks\/exhaustive-deps\n  \}, \[userLoaded\]\);/,
    `useEffect(() => {
    // We start in "pick" phase, so we don't auto-start the round unless we want to skip pick.
    // The user explicitly asked to connect the Feihua search UI.
  }, [userLoaded]);`
);

// Inject the pick phase UI
const uiStartRegex = /<div style={{ padding: "16px", maxWidth: "480px", margin: "0 auto", boxSizing: "border-box" }}>\n\s*\{\/\* Header \*\/\}/;
const pickPhaseUI = `<div style={{ padding: "16px", maxWidth: "480px", margin: "0 auto", boxSizing: "border-box" }}>
      {phase === "pick" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800">寻花令</h2>
            <p className="mt-1 text-sm text-gray-500">
              通过搜索指定字词，系统将为你挑选一首相关的诗词并提取对句作为目标
            </p>
          </div>

          <button onClick={handleRandom} className="w-full py-3 bg-[#6aaa64] text-white font-bold rounded-lg hover:bg-[#5a9a54] transition">
            随机抽题开始（原模式）
          </button>

          <div className="text-center text-xs text-gray-400">— 或 手动输入搜索词提取题库 —</div>

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={customChar}
                onChange={(e) => setCustomChar(e.target.value)}
                placeholder="请输入字词（如：酒 或 少年）"
                className="flex-[3] text-center px-4 py-3 border border-gray-300 rounded-lg outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const cleaned = customChar.trim().replace(/[^\\u4e00-\\u9fa5]/g, "");
                    if (cleaned.length >= 1) {
                      selectChar(cleaned, cleaned.length > 1 ? matchType : 'exact');
                    } else {
                      setFeedback({ ok: false, msg: "请输入汉字作为关键字" });
                    }
                  }
                }}
              />
              <button
                onClick={() => {
                  const cleaned = customChar.trim().replace(/[^\\u4e00-\\u9fa5]/g, "");
                  if (cleaned.length >= 1) {
                    selectChar(cleaned, cleaned.length > 1 ? matchType : 'exact');
                  } else {
                    setFeedback({ ok: false, msg: "请输入汉字作为关键字" });
                  }
                }}
                className="flex-1 px-4 py-3 bg-[#6aaa64] text-white font-bold rounded-lg text-center whitespace-nowrap"
              >
                搜索并开始
              </button>
            </div>
            
            {customChar.trim().replace(/[^\\u4e00-\\u9fa5]/g, "").length > 1 && (
              <div className="flex items-center justify-center gap-4 text-sm text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-200">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="matchType"
                    value="exact"
                    checked={matchType === 'exact'}
                    onChange={() => setMatchType('exact')}
                    className="accent-[#6aaa64]"
                  />
                  连续 (如: {customChar.trim().replace(/[^\\u4e00-\\u9fa5]/g, "")})
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="matchType"
                    value="scattered"
                    checked={matchType === 'scattered'}
                    onChange={() => setMatchType('scattered')}
                    className="accent-[#6aaa64]"
                  />
                  分散 (只要包含即可)
                </label>
              </div>
            )}
          </div>

          {feedback && !feedback.ok && (
            <p className="text-center text-sm text-[#c9b458]">{feedback.msg}</p>
          )}

          <div className="text-center text-xs text-gray-400">— 或 常用快捷选字 —</div>

          <CharPicker selected={selectedChar} onSelect={(c) => selectChar(c, 'exact')} />
        </div>
      )}

      {phase !== "pick" && (
        <>
          {/* Header */}`;

content = content.replace(uiStartRegex, pickPhaseUI);

// Close the React fragment at the very end
content = content.replace(/    <\/div>\n  \);\n\}\n$/, "        </>\n      )}\n    </div>\n  );\n}\n");


fs.writeFileSync('src/components/games/XunhuaGame.tsx', content);
console.log("Patched XunhuaGame.tsx with Pick Phase.");
