/**
 * onlineSearch.ts — 运行时从 GitHub yxcs/poems-db 在线搜索诗句
 *
 * 直接 fetch 四个 NDJSON 文件，不存储本地。
 * 搜索对象：诗句内容（content 数组中的每一句）
 */

export interface OnlinePoemResult {
  _id: string;
  name: string;
  author: string;
  dynasty: string;
  content: string[];
  note: string;
  matchedLine: string;      // 匹配到的原句（含标点）
  matchedLineIndex: number; // content 数组中的索引
}

export interface OnlineSearchResult {
  poem: OnlinePoemResult;
  score: number; // 越高越相关
}

const YXCS_URLS = [
  "https://raw.githubusercontent.com/yxcs/poems-db/master/poems1.json",
  "https://raw.githubusercontent.com/yxcs/poems-db/master/poems2.json",
  "https://raw.githubusercontent.com/yxcs/poems-db/master/poems3.json",
  "https://raw.githubusercontent.com/yxcs/poems-db/master/poems4.json",
];

function stripPunctuation(s: string): string {
  return s.replace(
    /[，。？！、；：""''【】「」()（）·—–\-…\s.,?!'":;\[\]「」『』【】]/g,
    ""
  );
}

function cleanHtml(text: string): string {
  return text.replace(/<[^>]+>/g, "").trim();
}

function lineScore(cleanLine: string, query: string): number {
  const q = query.trim();
  if (cleanLine === q) return 100;           // 精确匹配
  if (cleanLine.includes(q)) return 80;       // 子串匹配
  if (q.includes(cleanLine) && cleanLine.length >= 4) return 70;
  return 0;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

// 会话缓存：避免重复搜索
const cache = new Map<string, OnlineSearchResult[]>();

/**
 * 在线搜索诗句。
 * 并行抓取四个 NDJSON 文件，每文件独立收集，互不阻塞，
 * 最后汇总所有结果，按 score 排序取前 maxResults 条。
 */
export async function searchOnline(
  query: string,
  maxResults = 8
): Promise<OnlineSearchResult[]> {
  const key = query.trim();
  if (!key) return [];
  if (cache.has(key)) return cache.get(key)!;

  const allFileResults: OnlineSearchResult[][] = [];

  const promises = YXCS_URLS.map(async (url): Promise<OnlineSearchResult[]> => {
    const fileResults: OnlineSearchResult[] = [];
    const seenKeys = new Set<string>();

    try {
      const resp = await fetch(url, {
        headers: { "User-Agent": "fengyuqing/1.0" },
      });
      if (!resp.ok || !resp.body) return [];

      const reader = resp.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;

          let obj: Record<string, unknown>;
          try {
            obj = JSON.parse(line) as Record<string, unknown>;
          } catch {
            continue;
          }

          const name = (obj.name || obj.title || "") as string;
          if (!name) continue;

          const rawContent = (obj.content || []) as unknown[];
          if (!Array.isArray(rawContent) || rawContent.length === 0) continue;

          for (let i = 0; i < rawContent.length; i++) {
            const raw = cleanHtml(String(rawContent[i]));
            const clean = stripPunctuation(raw);
            if (!clean || clean.length < 4) continue;

            // 精确/子串匹配
            let score = lineScore(clean, key);
            if (score === 0 && clean.length >= 4 && key.length >= 4) {
              const maxDist = Math.max(clean.length, key.length) <= 9 ? 3 : 4;
              if (Math.abs(clean.length - key.length) <= maxDist) {
                const dist = levenshtein(clean, key);
                if (dist <= maxDist) {
                  score = Math.max(0, 60 - dist * 10);
                }
              }
            }

            if (score > 0) {
              const dupKey = `${name}:${(obj.author || "") as string}:${i}`;
              if (!seenKeys.has(dupKey)) {
                seenKeys.add(dupKey);
                fileResults.push({
                  poem: {
                    _id: typeof obj._id === "object" && obj._id !== null
                      ? String((obj._id as Record<string, unknown>)["$oid"] || "")
                      : (obj._id as string) || "",
                    name,
                    author: (obj.author || "佚名") as string,
                    dynasty: (obj.dynasty || "") as string,
                    content: rawContent.map((c) => cleanHtml(String(c))),
                    note: (obj.note || "") as string,
                    matchedLine: raw,
                    matchedLineIndex: i,
                  },
                  score,
                });
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[onlineSearch] Failed to fetch ${url}:`, err);
    }

    return fileResults;
  });

  const timeout = new Promise<OnlineSearchResult[][]>((resolve) =>
    setTimeout(() => resolve([]), 30000)
  );

  const fileResults = await Promise.race([
    Promise.all(promises),
    timeout,
  ]);

  // 合并所有文件结果，按 score 降序
  const merged = fileResults.flat();
  merged.sort((a, b) => b.score - a.score);
  const top = merged.slice(0, maxResults);
  cache.set(key, top);
  return top;
}

/**
 * 验证单句是否存在于在线数据库
 */
export async function verifyOnline(
  line: string
): Promise<OnlinePoemResult | null> {
  const results = await searchOnline(line, 1);
  if (results.length === 0) return null;
  const { poem, score } = results[0];
  // 必须是精确或高度相似匹配
  if (score >= 60) return poem;
  return null;
}

/** 清除搜索缓存（通常不需要手动调用） */
export function clearSearchCache() {
  cache.clear();
}
