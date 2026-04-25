import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "风雨情",
  description: "古诗词练习平台 — 飞花令、接龙、寻花令",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hans">
      <body>
        {/* 山水背景层 — 使用 zIndex:-1 固定在底层，不被内容覆盖 */}
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: -1,
            pointerEvents: "none",
            overflow: "hidden",
            background: "#f7f3ed",
          }}
        >
          {/* === 远山层：水墨晕染效果 === */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1440 900"
            width="1440"
            height="900"
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              {/* 宣纸底纹 */}
              <filter id="paper">
                <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="5" result="noise"/>
                <feColorMatrix type="saturate" values="0" in="noise" result="gray"/>
                <feBlend in="SourceGraphic" in2="gray" mode="multiply"/>
              </filter>

              {/* 水墨晕染渐变 - 远山 */}
              <linearGradient id="inkFar" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#5a4a3a" stopOpacity="0"/>
                <stop offset="35%" stopColor="#4a3d30" stopOpacity="0.22"/>
                <stop offset="70%" stopColor="#3a3028" stopOpacity="0.30"/>
                <stop offset="100%" stopColor="#2c2416" stopOpacity="0.45"/>
              </linearGradient>

              {/* 水墨晕染渐变 - 中山 */}
              <linearGradient id="inkMid" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#4a3d30" stopOpacity="0"/>
                <stop offset="40%" stopColor="#3d3228" stopOpacity="0.28"/>
                <stop offset="100%" stopColor="#1a1612" stopOpacity="0.50"/>
              </linearGradient>

              {/* 水墨晕染渐变 - 近山 */}
              <linearGradient id="inkNear" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#2c2416" stopOpacity="0"/>
                <stop offset="30%" stopColor="#1a1612" stopOpacity="0.35"/>
                <stop offset="100%" stopColor="#0f0d0a" stopOpacity="0.65"/>
              </linearGradient>

              {/* 晨雾渐变 */}
              <radialGradient id="mist1" cx="20%" cy="60%" r="60%">
                <stop offset="0%" stopColor="#c8b89a" stopOpacity="0.40"/>
                <stop offset="100%" stopColor="#c8b89a" stopOpacity="0"/>
              </radialGradient>
              <radialGradient id="mist2" cx="75%" cy="45%" r="55%">
                <stop offset="0%" stopColor="#bca882" stopOpacity="0.35"/>
                <stop offset="100%" stopColor="#bca882" stopOpacity="0"/>
              </radialGradient>
              <radialGradient id="mist3" cx="50%" cy="80%" r="50%">
                <stop offset="0%" stopColor="#d4c4a8" stopOpacity="0.30"/>
                <stop offset="100%" stopColor="#d4c4a8" stopOpacity="0"/>
              </radialGradient>

              {/* 笔触纹理 */}
              <filter id="brush">
                <feTurbulence type="turbulence" baseFrequency="0.015 0.04" numOctaves="3" seed="3" result="noise"/>
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" xChannelSelector="R" yChannelSelector="G"/>
              </filter>
            </defs>

            {/* 宣纸底色 */}
            <rect width="1440" height="900" fill="#f5f0e8"/>

            {/* 远山 - 用贝塞尔曲线画柔和山峦 */}
            <path
              d="M-50 900 C80 580 160 640 280 500 C380 380 460 450 560 360 C660 270 740 340 840 260 C940 180 1040 260 1140 180 C1220 120 1320 200 1440 160 L1440 900 Z"
              fill="url(#inkFar)"
              filter="url(#brush)"
            />

            {/* 中景山峦 */}
            <path
              d="M-50 900 C40 700 120 760 240 620 C340 500 420 580 520 480 C620 380 700 460 800 380 C900 300 980 380 1080 300 C1180 220 1280 300 1440 240 L1440 900 Z"
              fill="url(#inkMid)"
              filter="url(#brush)"
            />

            {/* 近景山峦 */}
            <path
              d="M-50 900 C80 780 180 840 300 720 C400 620 480 700 580 600 C680 500 760 580 860 500 C960 420 1040 500 1140 420 C1240 340 1340 420 1440 360 L1440 900 Z"
              fill="url(#inkNear)"
            />

            {/* 水墨云雾层 - 柔和的椭圆晕染 */}
            <ellipse cx="260" cy="540" rx="420" ry="120" fill="url(#mist1)"/>
            <ellipse cx="1050" cy="480" rx="480" ry="130" fill="url(#mist2)"/>
            <ellipse cx="720" cy="660" rx="380" ry="90" fill="url(#mist3)"/>
            <ellipse cx="1400" cy="600" rx="300" ry="100" fill="#c8b89a" opacity="0.15"/>

            {/* 松树剪影 - 用笔触滤镜柔化 */}
            <g fill="#1a1612" opacity="0.20" filter="url(#brush)">
              <polygon points="180,760 162,800 172,800 155,840 165,840 148,880 212,880 195,840 205,840 188,800 198,800"/>
              <polygon points="1280,680 1262,720 1272,720 1255,760 1265,760 1248,800 1312,800 1295,760 1305,760 1288,720 1298,720"/>
              <polygon points="680,740 662,780 672,780 655,820 665,820 648,860 712,860 695,820 705,820 688,780 698,780"/>
            </g>

            {/* 远山飞鸟 */}
            <g stroke="#2c2416" strokeWidth="1" fill="none" opacity="0.12">
              <path d="M200 280 Q210 270 220 280 Q230 270 240 280"/>
              <path d="M900 320 Q910 310 920 320 Q930 310 940 320"/>
              <path d="M1100 240 Q1110 230 1120 240 Q1130 230 1140 240"/>
            </g>

            {/* 落款朱砂印章 */}
            <rect x="1320" y="820" width="50" height="50" fill="#c0392b" opacity="0.12" rx="2"/>
            <text x="1345" y="852" textAnchor="middle" fontSize="18" fill="#c0392b" opacity="0.15" fontFamily="serif">詩</text>
          </svg>

          {/* === 竹韵边饰 - 右侧 === */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 160 900"
            width="160"
            height="900"
            style={{ position: "absolute", right: 0, top: 0, height: "100%" }}
            preserveAspectRatio="xMaxYMid meet"
          >
            <defs>
              <linearGradient id="bGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#1a1612" stopOpacity="0.55"/>
                <stop offset="100%" stopColor="#1a1612" stopOpacity="0.08"/>
              </linearGradient>
              <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2c2416" stopOpacity="0.60"/>
                <stop offset="100%" stopColor="#3a3028" stopOpacity="0.20"/>
              </linearGradient>
            </defs>

            {/* 竹竿 */}
            <g stroke="url(#bGrad)" strokeWidth="2.5" fill="none" strokeLinecap="round">
              <line x1="50" y1="0" x2="50" y2="900"/>
              <line x1="90" y1="30" x2="90" y2="900"/>
              <line x1="130" y1="15" x2="130" y2="900"/>
            </g>

            {/* 侧枝 */}
            <g stroke="#2c2416" strokeWidth="1.5" fill="none" opacity="0.45">
              <path d="M50 150 Q28 128 10 138"/>
              <path d="M50 320 Q26 298 8 308"/>
              <path d="M50 500 Q32 478 16 488"/>
              <path d="M50 680 Q30 658 14 668"/>
              <path d="M90 220 Q115 196 138 206"/>
              <path d="M90 400 Q118 376 142 386"/>
              <path d="M90 590 Q118 568 140 578"/>
              <path d="M130 280 Q106 258 82 268"/>
              <path d="M130 460 Q104 438 78 448"/>
            </g>

            {/* 竹叶 - 柔和渐变填充 */}
            <g fill="url(#leafGrad)">
              {/* 左侧叶 */}
              <ellipse cx="8" cy="136" rx="16" ry="4.5" transform="rotate(-28 8 136)"/>
              <ellipse cx="14" cy="148" rx="13" ry="3.5" transform="rotate(-18 14 148)"/>
              <ellipse cx="5" cy="306" rx="15" ry="4" transform="rotate(-24 5 306)"/>
              <ellipse cx="12" cy="318" rx="12" ry="3.5" transform="rotate(-14 12 318)"/>
              <ellipse cx="14" cy="486" rx="14" ry="4" transform="rotate(-26 14 486)"/>
              <ellipse cx="8" cy="500" rx="12" ry="3.5" transform="rotate(-16 8 500)"/>
              <ellipse cx="12" cy="666" rx="15" ry="4" transform="rotate(-22 12 666)"/>
              {/* 右侧叶 */}
              <ellipse cx="140" cy="204" rx="16" ry="4.5" transform="rotate(28 140 204)"/>
              <ellipse cx="134" cy="216" rx="13" ry="3.5" transform="rotate(18 134 216)"/>
              <ellipse cx="142" cy="384" rx="15" ry="4" transform="rotate(24 142 384)"/>
              <ellipse cx="136" cy="396" rx="12" ry="3.5" transform="rotate(14 136 396)"/>
              <ellipse cx="140" cy="576" rx="14" ry="4" transform="rotate(26 140 576)"/>
              <ellipse cx="80" cy="266" rx="16" ry="4.5" transform="rotate(30 80 266)"/>
              <ellipse cx="76" cy="448" rx="14" ry="4" transform="rotate(28 76 448)"/>
            </g>

            {/* 竹节 */}
            <g stroke="#1a1612" strokeWidth="1.5" fill="none" opacity="0.22">
              {[140, 200, 260, 320, 380, 440, 500, 560, 620, 680, 740, 800, 860].map((y) => (
                <line key={y} x1="44" y1={y} x2="56" y2={y}/>
              ))}
              {[160, 220, 280, 340, 400, 460, 520, 580, 640, 700, 760, 820, 880].map((y) => (
                <line key={y} x1="84" y1={y} x2="96" y2={y}/>
              ))}
              {[150, 210, 270, 330, 390, 450, 510, 570, 630, 690, 750, 810, 870].map((y) => (
                <line key={y} x1="124" y1={y} x2="136" y2={y}/>
              ))}
            </g>
          </svg>

          {/* === 水波底纹 - 底部 === */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1440 280"
            width="1440"
            height="280"
            style={{ position: "absolute", bottom: 0, left: 0, width: "100%" }}
            preserveAspectRatio="xMidYMax meet"
          >
            <defs>
              <linearGradient id="waveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#8b7355" stopOpacity="0"/>
                <stop offset="60%" stopColor="#7a6348" stopOpacity="0.18"/>
                <stop offset="100%" stopColor="#5a4a3a" stopOpacity="0.30"/>
              </linearGradient>
              <linearGradient id="waveGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#6b5540" stopOpacity="0"/>
                <stop offset="100%" stopColor="#4a3d30" stopOpacity="0.20"/>
              </linearGradient>
            </defs>

            {/* 水墨波纹 */}
            <path
              d="M0 280 C120 240 240 260 360 245 C480 230 600 250 720 235 C840 220 960 240 1080 225 C1200 210 1320 235 1440 220 L1440 280 Z"
              fill="url(#waveGrad)"
            />
            <path
              d="M0 280 C100 260 220 270 360 258 C500 246 640 265 780 252 C920 240 1060 258 1200 246 C1340 234 1420 250 1440 248 L1440 280 Z"
              fill="url(#waveGrad2)"
            />
          </svg>

          {/* 顶部渐变淡出，让内容融入背景 */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "120px",
              background: "linear-gradient(to bottom, #f7f3ed 60%, transparent)",
              opacity: 0.5,
            }}
          />
        </div>

        {/* 主内容层 */}
        <div style={{ position: "relative", zIndex: 1 }}>
          {children}
        </div>
      </body>
    </html>
  );
}
