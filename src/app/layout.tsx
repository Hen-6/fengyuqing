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
        {/* 山水背景层 - 使用 inline SVG，确保兼容性 */}
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            overflow: "hidden",
          }}
        >
          {/* 远山层 */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1200 800"
            width="1200"
            height="800"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.38,
            }}
          >
            <defs>
              <linearGradient id="ink1" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#2c2416" stopOpacity="0.8"/>
                <stop offset="100%" stopColor="#2c2416" stopOpacity="0"/>
              </linearGradient>
            </defs>
            {/* 远山 */}
            <path d="M-50 800 L80 520 L180 580 L280 450 L380 510 L500 380 L620 460 L720 350 L820 430 L920 300 L1020 390 L1120 260 L1200 320 L1200 800 Z" fill="url(#ink1)" opacity="0.6"/>
            {/* 中山 */}
            <path d="M-50 800 L50 600 L150 660 L250 520 L380 600 L500 480 L640 560 L760 440 L880 520 L1000 400 L1120 480 L1200 400 L1200 800 Z" fill="#2c2416" opacity="0.5"/>
            {/* 近山 */}
            <path d="M-50 800 L100 680 L220 740 L360 620 L480 700 L600 600 L720 680 L860 560 L980 640 L1100 580 L1200 620 L1200 800 Z" fill="#1a1612" opacity="0.7"/>
            {/* 云雾 */}
            <ellipse cx="200" cy="480" rx="300" ry="80" fill="#8B7355" opacity="0.08"/>
            <ellipse cx="700" cy="400" rx="350" ry="90" fill="#8B7355" opacity="0.06"/>
            <ellipse cx="1100" cy="500" rx="280" ry="70" fill="#8B7355" opacity="0.05"/>
          </svg>

          {/* 竹韵边饰 - 右侧 */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 200 600"
            width="200"
            height="600"
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              height: "100%",
              width: "140px",
              opacity: 0.5,
            }}
          >
            <defs>
              <linearGradient id="bambooGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2c2416" stopOpacity="0.8"/>
                <stop offset="100%" stopColor="#2c2416" stopOpacity="0.3"/>
              </linearGradient>
            </defs>
            {/* 竹竿 */}
            <g fill="none" stroke="url(#bambooGrad)" strokeWidth="3" strokeLinecap="round">
              <line x1="60" y1="0" x2="60" y2="600"/>
              <line x1="100" y1="20" x2="100" y2="600"/>
              <line x1="140" y1="10" x2="140" y2="600"/>
              <path d="M60 120 Q40 100 20 110"/>
              <path d="M60 280 Q35 260 15 270"/>
              <path d="M60 450 Q40 430 25 440"/>
              <path d="M100 180 Q125 155 145 165"/>
              <path d="M100 360 Q130 340 150 350"/>
              <path d="M140 250 Q115 230 95 240"/>
              <path d="M140 500 Q110 480 90 490"/>
            </g>
            {/* 竹叶 */}
            <g fill="#2c2416" opacity="0.7">
              <ellipse cx="18" cy="108" rx="18" ry="5" transform="rotate(-30 18 108)"/>
              <ellipse cx="12" cy="118" rx="15" ry="4" transform="rotate(-20 12 118)"/>
              <ellipse cx="22" cy="130" rx="16" ry="4.5" transform="rotate(-40 22 130)"/>
              <ellipse cx="13" cy="268" rx="17" ry="4.5" transform="rotate(-25 13 268)"/>
              <ellipse cx="20" cy="280" rx="14" ry="4" transform="rotate(-35 20 280)"/>
              <ellipse cx="23" cy="438" rx="16" ry="4.5" transform="rotate(-30 23 438)"/>
              <ellipse cx="147" cy="163" rx="18" ry="5" transform="rotate(30 147 163)"/>
              <ellipse cx="152" cy="175" rx="15" ry="4" transform="rotate(20 152 175)"/>
              <ellipse cx="152" cy="348" rx="17" ry="4.5" transform="rotate(25 152 348)"/>
              <ellipse cx="147" cy="360" rx="14" ry="4" transform="rotate(35 147 360)"/>
              <ellipse cx="93" cy="238" rx="18" ry="5" transform="rotate(30 93 238)"/>
              <ellipse cx="92" cy="488" rx="16" ry="4.5" transform="rotate(30 92 488)"/>
            </g>
            {/* 竹节 */}
            <g stroke="#2c2416" strokeWidth="1.5" fill="none" opacity="0.3">
              <line x1="54" y1="120" x2="66" y2="120"/>
              <line x1="54" y1="180" x2="66" y2="180"/>
              <line x1="54" y1="240" x2="66" y2="240"/>
              <line x1="54" y1="300" x2="66" y2="300"/>
              <line x1="54" y1="360" x2="66" y2="360"/>
              <line x1="54" y1="420" x2="66" y2="420"/>
              <line x1="54" y1="480" x2="66" y2="480"/>
              <line x1="94" y1="140" x2="106" y2="140"/>
              <line x1="94" y1="200" x2="106" y2="200"/>
              <line x1="94" y1="260" x2="106" y2="260"/>
              <line x1="94" y1="320" x2="106" y2="320"/>
              <line x1="94" y1="380" x2="106" y2="380"/>
              <line x1="134" y1="130" x2="146" y2="130"/>
              <line x1="134" y1="190" x2="146" y2="190"/>
              <line x1="134" y1="250" x2="146" y2="250"/>
              <line x1="134" y1="310" x2="146" y2="310"/>
              <line x1="134" y1="370" x2="146" y2="370"/>
            </g>
          </svg>

          {/* 水波底纹 */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1440 320"
            width="1440"
            height="320"
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              width: "100%",
              height: "180px",
              objectFit: "cover",
              opacity: 0.35,
            }}
          >
            <defs>
              <linearGradient id="waveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#8B7355" stopOpacity="0"/>
                <stop offset="100%" stopColor="#8B7355" stopOpacity="0.5"/>
              </linearGradient>
            </defs>
            <path d="M0 320 Q180 280 360 300 Q540 320 720 290 Q900 260 1080 285 Q1260 310 1440 280 L1440 320 Z" fill="url(#waveGrad)" opacity="0.4"/>
            <path d="M0 320 Q200 300 400 315 Q600 330 800 305 Q1000 280 1200 300 Q1350 315 1440 295 L1440 320 Z" fill="#8B7355" opacity="0.15"/>
          </svg>
        </div>

        {/* 主内容层 */}
        <div style={{ position: "relative", zIndex: 1 }}>
          {children}
        </div>
      </body>
    </html>
  );
}
