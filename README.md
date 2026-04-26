# 风雨情 · 古诗词练习平台

> 通过飞花令、接龙、寻花令三种游戏，轻松记住古诗词。

**在线地址**: https://hen-6.github.io/fengyuqing/

---

## 游戏

### 🌸 飞花令
选择一个关键字，系统展示一句含该字的诗，你来接出另一句。

### 🔗 接龙
系统出上句，你接下句，要求：末字相同、诗句在库、≥4字。

### 🌺 寻花令
100字提示格，猜出五言或七言对句。绿色=位置正确，黄色=存在但位置错误，灰色=不存在。

---

## 熟悉度体系

| 等级 | 名称 | 说明 |
|------|------|------|
| 1 | 陌生 | 完全不认识 |
| 2 | 认字 | 见过诗题/作者 |
| 3 | 识句 | 能找出一句以上 |
| 4 | 成篇 | 能背诵整首 |
| 5 | 全知 | 知道作者/背景/典故 |

游戏答对自动升至 Level 3，基于 Duolingo HLR 算法安排复习。

---

## 技术栈

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS v4
- Web Speech API 语音输入
- localStorage 本地进度存储
- GitHub Actions → GitHub Pages

---

## 本地运行

```bash
git clone https://github.com/Hen-6/fengyuqing.git
cd fengyuqing
npm install
npm run dev
```

---

## 数据来源

73首精选古诗词，来自 [yusjoel/XunHuaLing](https://github.com/yusjoel/XunHuaLing) 权威榜单，按唐诗三百首、义务教育必背篇目次序排列。
