const fs = require('fs');
let content = fs.readFileSync('src/components/games/LearnGame.tsx', 'utf8');

const target = `) : (
          currentPoem && (`;
const replace = `) : (
          currentPoem ? (`;

const target2 = `)
        )}
      </div>`;
const replace2 = `) : (
            <div style={{ padding: "40px" }}>
              <p>无法加载该诗词数据（{currentKey}）</p>
              <button onClick={() => startNext(store)} style={{ marginTop: "16px", padding: "8px 16px", cursor: "pointer" }}>跳过</button>
            </div>
          )
        )}
      </div>`;

content = content.replace(target, replace);
content = content.replace(target2, replace2);
fs.writeFileSync('src/components/games/LearnGame.tsx', content);
