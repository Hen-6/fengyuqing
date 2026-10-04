const fs = require('fs');
let content = fs.readFileSync('src/components/ui/OnlinePoemCard.tsx', 'utf8');

// The props interface doesn't need to change if it relies on OnlinePoemResult, which is PoemResult which we already added trans, shangxi, tags to.
content = content.replace(
  'const { name, author, dynasty, content, note, matchedLineIndex } = result;',
  'const { name, author, dynasty, content, note, trans, shangxi, tags, matchedLineIndex } = result;'
);

const oldNoteSection = `{/* 赏析 */}
      {note && (
        <div className="mt-4 rounded-lg bg-paper/60 p-3">
          <p className="text-xs text-text-muted leading-relaxed">{note}</p>
        </div>
      )}`;

const newNoteSection = `{/* 标签 */}
      {tags && tags.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {tags.map((tag, idx) => (
            <span key={idx} className="px-2 py-0.5 rounded bg-accent/10 text-accent text-xs border border-accent/20">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* 注释/翻译/赏析 (可展开) */}
      {(note || trans || shangxi) && (
        <div className="mt-4 space-y-2 text-left">
          {trans && (
            <details className="group rounded-lg bg-paper/60 p-3 open:bg-paper/80 border border-transparent open:border-border transition-colors">
              <summary className="text-sm font-semibold text-ink cursor-pointer flex items-center justify-between outline-none">
                译文
                <span className="text-text-muted group-open:rotate-180 transition-transform">↓</span>
              </summary>
              <div className="mt-2 text-sm text-text-muted leading-relaxed whitespace-pre-wrap">{trans}</div>
            </details>
          )}
          {note && (
            <details className="group rounded-lg bg-paper/60 p-3 open:bg-paper/80 border border-transparent open:border-border transition-colors">
              <summary className="text-sm font-semibold text-ink cursor-pointer flex items-center justify-between outline-none">
                注释
                <span className="text-text-muted group-open:rotate-180 transition-transform">↓</span>
              </summary>
              <div className="mt-2 text-sm text-text-muted leading-relaxed whitespace-pre-wrap">{note}</div>
            </details>
          )}
          {shangxi && (
            <details className="group rounded-lg bg-paper/60 p-3 open:bg-paper/80 border border-transparent open:border-border transition-colors">
              <summary className="text-sm font-semibold text-ink cursor-pointer flex items-center justify-between outline-none">
                赏析
                <span className="text-text-muted group-open:rotate-180 transition-transform">↓</span>
              </summary>
              <div className="mt-2 text-sm text-text-muted leading-relaxed whitespace-pre-wrap">{shangxi}</div>
            </details>
          )}
        </div>
      )}`;

content = content.replace(oldNoteSection, newNoteSection);

content = content.replace(
  '数据来源：chinese-poetry 完整题库',
  '精选题库来源：aopao/chinese-gushiwen'
);

fs.writeFileSync('src/components/ui/OnlinePoemCard.tsx', content);
