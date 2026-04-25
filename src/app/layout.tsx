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
        {/* 山水背景层 - 使用 CSS background-image，可靠性更高 */}
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
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "url(/fengyuqing/ink-bg.svg)",
              backgroundRepeat: "no-repeat",
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: 0.4,
            }}
          />
          {/* 竹韵边饰 - 右侧 */}
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              width: "140px",
              height: "100%",
              backgroundImage: "url(/fengyuqing/bamboo.svg)",
              backgroundRepeat: "repeat-y",
              backgroundSize: "120px auto",
              backgroundPosition: "right top",
              opacity: 0.5,
            }}
          />
          {/* 水波底纹 */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              width: "100%",
              height: "200px",
              backgroundImage: "url(/fengyuqing/cloud-wave.svg)",
              backgroundRepeat: "no-repeat",
              backgroundSize: "cover",
              backgroundPosition: "bottom",
              opacity: 0.35,
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
