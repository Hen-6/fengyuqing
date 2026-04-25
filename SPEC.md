# 风雨情 — 古诗词练习平台

## 概述

风雨情是一个帮助用户记忆和练习中文古诗词的 Web 应用，支持飞花令、接龙、寻花令三种游戏，基于 Duolingo HLR + Leitner 间隔重复算法管理学习进度。

**在线地址**: https://hen-6.github.io/fengyuqing/

---

## 功能

### 游戏

| 游戏 | 规则 |
|------|------|
| **飞花令** | 选择一个字（预设20个高频字），系统展示一句诗，用户接出含该字的诗句（≥4字），自动升级到 Level 3 |
| **接龙** | 系统出上句，用户接下句，要求末字匹配、诗句在库、≥4字 |
| **寻花令** | 100字提示格（汉字阵），猜出五言/七言对句，绿/黄/灰配色，15次猜测，200分制 |

### 熟悉度体系（五级）

| 等级 | 名称 | 定义 |
|------|------|------|
| 1 | 陌生 | 完全不认识 |
| 2 | 认字 | 见过诗题/作者，无法背诵 |
| 3 | 识句 | 能找出一句以上的诗句 |
| 4 | 成篇 | 能背诵整首 |
| 5 | 全知 | 知道作者/背景/典故 |

**升级规则**：
- 游戏答对 → 自动升至 Level 3
- 连续答对2次（Leitner）→ 升级
- 连续答错2次 → 降级

### 记忆算法

- **半衰期回归（HLR）**：答对 ×2，答错 ×0.5
- **Leitner Box**：连续2次正确升一级，连续2次错误降一级
- 初始半衰期：1天，最小：0.25天，最大：365天

### 数据

- 73首精选古诗词（来自 XunHuaLing 权威榜单）
- 全部数据打包在构建产物中，无服务端依赖
- 进度存储于 localStorage

### 每日推荐

按 rank 顺序每日推进一首新诗，rank 到末尾后循环。

### 新用户引导

3轮飞花令测评（5→10→10个随机关键字），评估初始水平后初始化所有诗为 Level 1。

### Discord 机器人

| 命令 | 功能 |
|------|------|
| `/今日` | 发送今日推荐诗 |
| `/复习` | 发送今日待复习诗 |
| `/状态` | 显示个人进度统计 |

---

## 技术栈

- **前端**：Next.js 16 (App Router, static export) + React 19 + TypeScript
- **样式**：Tailwind CSS v4
- **语音**：Web Speech API + annyang.js
- **后端（可选）**：Python Discord.py 机器人
- **部署**：GitHub Actions → GitHub Pages

---

## 项目结构

```
src/
├── app/
│   ├── page.tsx              # 首页
│   ├── layout.tsx           # 根布局
│   ├── onboarding/page.tsx  # 新用户引导
│   ├── daily/page.tsx       # 每日推荐
│   ├── progress/page.tsx    # 进度详情
│   └── games/
│       ├── feihua/          # 飞花令
│       ├── jielong/         # 接龙
│       └── xunhua/          # 寻花令
├── components/
│   ├── ui/                  # PoemCard, FamiliarityChart, CharPicker, VoiceInput
│   └── games/               # FeihuaGame, JielongGame, XunhuaGame
└── lib/
    ├── poems.ts             # 数据加载、索引构建
    ├── srs.ts              # HLR + Leitner 算法
    ├── user.ts             # localStorage 读写
    └── voice.ts            # Web Speech API 封装
```

---

## 本地开发

```bash
npm install
npm run dev     # 开发服务器
npm run build   # 生产构建
```

## 部署

推送到 `main` 分支即可自动部署到 GitHub Pages。
