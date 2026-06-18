/**
 * Meilisearch 本地搜索封装。
 *
 * 保留 localSearch.ts 所有导出签名，底层改为 Meilisearch 调用。
 * Meilisearch 实例运行在 127.0.0.1:7700（由 scripts/start_meilisearch.sh 启动）。
 */
// Web Crypto API 计算 MD5（浏览器兼容）
async function md5(str: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hashBuffer = await crypto.subtle.digest('MD5', data).catch(() => null)
  if (!hashBuffer) {
    // MD5 not available, fallback to simple hash
    let h = 0
    for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
    return Math.abs(h).toString(16).padStart(8, '0')
  }
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
import { Meilisearch } from 'meilisearch'
import { supabase } from './supabaseClient'

const MEILI_HOST = 'http://127.0.0.1:7700'
const MEILI_API_KEY = 'fengyuqing_dev'
const POEMS_INDEX = 'poems'

const client = new Meilisearch({ host: MEILI_HOST, apiKey: MEILI_API_KEY })

// ─── 连接状态 ───────────────────────────────────────────────
let _connected = false

export function isLoaded(): boolean {
  return _connected
}

export async function ensureLoaded(): Promise<void> {
  if (_connected) return
  await _connect()
}

async function _connect(): Promise<void> {
  try {
    await client.health()
    _connected = true
  } catch {
    _connected = false
    console.warn('Meilisearch is not running locally. Online/Supabase search will be used.')
  }
}

// ─── 类型定义 ───────────────────────────────────────────────
export interface MeiliDoc {
  id: string      // MD5 hash (Meilisearch primary key)
  key: string     // 原始 key "标题:作者"
  title: string
  author: string
  titleAuthor: string
  lines: string[]
  inLibrary: boolean
}

export interface MeiliSearchHit {
  id: string
  title: string
  author: string
  lines: string[]
  inLibrary: boolean
  _formatted?: { lines?: string[] }
}

// 兼容 PoemsContext / XunhuaGame 使用的 IndexedPoem 类型
export interface IndexedPoem {
  k: string   // key = "title:author"
  r: number   // rank (always 0 for full DB)
  t: string   // title
  a: string   // author
  d: string   // dynasty (always "" for full DB)
  id: string  // same as k
  c: string[] // content lines (raw, with punctuation)
  n: string   // note (always "")
}

export interface PoemResult {
  _id: string
  name: string
  author: string
  dynasty: string
  content: string[]
  note: string
  matchedLine: string
  matchedLineIndex: number
}

export type OnlinePoemResult = PoemResult

export interface SearchResult {
  poem: PoemResult
  score: number
}

// 去掉所有中文标点（全角/半角），用于精确匹配
function stripPunct(s: string): string {
  return s.replace(/[，。！？、；：""''（）【】《》〈〉〔〕—…·.!?,\s]/g, '')
}

// 规范化标题：去掉 · 和空格，用于生成一致的 MD5
const MIDDLE_DOT = '\u00b7'
function normalizeTitle(title: string): string {
  return title.replace(MIDDLE_DOT, '').replace(/ /g, '')
}

// 用规范化的 title:author 生成 MD5（与 index_meilisearch.py 一致）
async function canonicalMd5(title: string, author: string): Promise<string> {
  const canonical = `${normalizeTitle(title)}:${author}`
  return md5(canonical)
}

// 精确子串匹配：query 是否作为子串出现在 lines 中（忽略标点）
function linesContain(lines: string[], query: string): boolean {
  const norm = stripPunct(query)
  if (norm.length < 4) return true // 太短，跳过精确过滤
  return lines.some((line) => stripPunct(line).includes(norm))
}

// ─── 内部搜索 ───────────────────────────────────────────────
async function _search(query: string, options?: {
  limit?: number
  filter?: string
  exact?: boolean  // 是否启用精确子串过滤
}): Promise<SearchResult[]> {
  if (!_connected) {
    try {
      const { data, error } = await supabase.rpc('search_poems', {
        query_text: query,
        max_results: options?.limit ?? 8
      })
      if (error) throw error
      const results = data || []
      
      let finalResults = results.map((r: any) => {
        const lines = r.lines || []
        const normQuery = stripPunct(query)
        let matchedLineIndex = 0
        for (let i = 0; i < lines.length; i++) {
          if (stripPunct(lines[i]).includes(normQuery)) {
            matchedLineIndex = i
            break
          }
        }
        const matchedLine = lines[matchedLineIndex] || lines[0] || ''
        
        return {
          poem: {
            _id: r.id,
            name: r.title,
            author: r.author,
            dynasty: r.dynasty || '',
            content: lines,
            note: '',
            matchedLine,
            matchedLineIndex
          },
          score: 100
        }
      })

      if (options?.exact !== false) {
        finalResults = finalResults.filter((r: any) => linesContain(r.poem.content, query))
      }
      return finalResults
    } catch (err) {
      console.error('Supabase search failed, returning empty:', err)
      return []
    }
  }

  const index = client.index(POEMS_INDEX)
  // Meilisearch v1.43+ uses `q` not `query`
  const result = await index.search(query, {
    limit: options?.limit ?? 8,
    filter: options?.filter,
    attributesToRetrieve: ['id', 'key', 'title', 'author', 'lines', 'inLibrary'],
    attributesToHighlight: ['lines'],
    highlightPreTag: '『',
    highlightPostTag: '』',
  })

  let hits = result.hits as MeiliSearchHit[]

  // 精确子串过滤：只保留 lines 中真正包含查询字符串的文档
  if (options?.exact !== false) {
    hits = hits.filter((h) => linesContain(h.lines ?? [], query))
  }

  return hits.map((hit) => {
    const formattedLines: string[] = hit._formatted?.lines ?? hit.lines ?? []
    // 找到第一个高亮行作为 matchedLine
    let matchedLineIndex = 0
    for (let i = 0; i < formattedLines.length; i++) {
      if (formattedLines[i].includes('『') || formattedLines[i].includes('』')) {
        matchedLineIndex = i
        break
      }
    }
    const matchedLine: string = formattedLines[matchedLineIndex] ?? hit.lines?.[0] ?? ''

    return {
      poem: {
        _id: hit.id,
        name: hit.title,
        author: hit.author,
        dynasty: '',
        content: hit.lines ?? [],
        note: '',
        matchedLine,
        matchedLineIndex,
      },
      score: 100,
    }
  })
}

function normalizeForMatch(s: string): string {
  return s.trim().toLowerCase().replace(/[\u00b7\s，。！？、；：""''（）【】《》〈〉〔〕—…·.!?,\s]/g, '')
}

// ─── 公开 API（兼容 localSearch.ts 签名）───────────────────
export async function searchOnline(
  query: string,
  maxResults = 8
): Promise<SearchResult[]> {
  return _search(query, { limit: maxResults })
}

export async function generalSearch(
  query: string,
  maxResults = 2000
): Promise<SearchResult[]> {
  const normQuery = normalizeForMatch(query)
  if (!normQuery) return []

  const rawResults = await _search(query, { limit: maxResults, exact: false })

  const scored = rawResults.map(res => {
    const normAuthor = normalizeForMatch(res.poem.author)
    const normTitle = normalizeForMatch(res.poem.name)
    
    let priority = 4 // lowest priority
    
    if (normAuthor === normQuery) {
      priority = 1
    } else if (normAuthor.includes(normQuery)) {
      priority = 2
    } else if (normTitle.includes(normQuery)) {
      priority = 3
    }
    
    return { res, priority }
  })

  scored.sort((a, b) => a.priority - b.priority)

  return scored.map(item => item.res)
}

export async function searchByChar(
  char: string,
  maxResults = 20
): Promise<SearchResult[]> {
  return _search(char, { limit: maxResults })
}

export async function searchInLibrary(
  query: string,
  maxResults = 20
): Promise<SearchResult[]> {
  return _search(query, { limit: maxResults, filter: 'inLibrary = true' })
}

export async function getPoemByKeyExport(key: string): Promise<SearchResult | null> {
  if (!_connected) {
    try {
      const { data, error } = await supabase
        .from('poems')
        .select('*')
        .eq('key', key)
        .maybeSingle()
      if (error || !data) return null
      return {
        poem: {
          _id: data.id,
          name: data.title,
          author: data.author,
          dynasty: data.dynasty || '',
          content: data.lines ?? [],
          note: '',
          matchedLine: data.lines?.[0] ?? '',
          matchedLineIndex: 0,
        },
        score: 100,
      }
    } catch {
      return null
    }
  }

  try {
    const lastColon = key.lastIndexOf(':')
    const title = lastColon >= 0 ? key.slice(0, lastColon) : ''
    const author = lastColon >= 0 ? key.slice(lastColon + 1) : ''
    
    // Instead of computing MD5 (which fails in browser WebCrypto), search by title and author
    const query = `${title} ${author}`.trim()
    const result = await client.index(POEMS_INDEX).search(query, {
      limit: 10,
      attributesToRetrieve: ['id', 'key', 'title', 'author', 'lines', 'inLibrary'],
    })
    
    const doc = result.hits.find(h => h.key === key) as MeiliDoc | undefined
    if (!doc) return null
    
    return {
      poem: {
        _id: doc.id,
        name: doc.title,
        author: doc.author,
        dynasty: '',
        content: doc.lines ?? [],
        note: '',
        matchedLine: doc.lines?.[0] ?? '',
        matchedLineIndex: 0,
      },
      score: 100,
    }
  } catch {
    return null
  }
}

export async function setInLibrary(key: string, inLibrary: boolean): Promise<void> {
  if (!_connected) return // No-op online
  const poemResult = await getPoemByKeyExport(key)
  if (poemResult) {
    await client.index(POEMS_INDEX).updateDocuments([{ id: poemResult.poem._id, inLibrary }])
  }
}

// ─── 全量诗词（用于 XunhuaGame couplet pool）─────────────────
// 分页批量获取，避免单次请求过大
let _allPoemsCache: IndexedPoem[] | null = null

export async function getAllPoems(): Promise<IndexedPoem[]> {
  if (_allPoemsCache) return _allPoemsCache

  if (!_connected) {
    try {
      const res = await fetch('/data/all_poems_lookup.json')
      const data = await res.json()
      const all: IndexedPoem[] = data.poems.map((p: any) => ({
        k: `${p.t}:${p.a}`,
        r: 0,
        t: p.t,
        a: p.a,
        d: p.d || '',
        id: `${p.t}:${p.a}`,
        c: p.content || [],
        n: '',
      }))
      _allPoemsCache = all
      return all
    } catch (err) {
      console.error('Failed to load all poems lookup:', err)
      return []
    }
  }

  const index = client.index(POEMS_INDEX)
  const all: IndexedPoem[] = []
  let offset = 0
  const PAGE = 1000

  while (true) {
    const page = await index.getDocuments({
      fields: ['id', 'title', 'author', 'lines'],
      limit: PAGE,
      offset,
    })
    for (const doc of page.results as unknown as MeiliDoc[]) {
      all.push({
        k: (doc as MeiliDoc).key ?? '',
        r: 0,
        t: doc.title,
        a: doc.author,
        d: '',
        id: (doc as MeiliDoc).key ?? '',
        c: doc.lines ?? [],
        n: '',
      })
    }
    if (page.results.length < PAGE) break
    offset += PAGE
  }

  _allPoemsCache = all
  return all
}

// 兼容 localSearch.ts 的同步别名（仅为类型兼容，实际返回 Promise）
export function getAllPoemKeys(): string[] {
  // 同步版本仅在已缓存时可用
  if (_allPoemsCache) return _allPoemsCache.map((p) => p.k)
  // 未缓存时返回空（调用方应使用 async getAllPoems）
  return []
}

// ─── 兼容别名 ───────────────────────────────────────────────
export const localSearch = searchOnline
