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
        {/* 山水背景层 */}
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
          {/* 远山 + 云雾 */}
          <img
            src="/fengyuqing/ink-bg.svg"
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.08 }}
          />
          {/* 竹韵边饰 */}
          <img
            src="/fengyuqing/bamboo.svg"
            alt=""
            style={{ position: "absolute", right: 0, top: 0, height: "100%", width: "120px", objectFit: "cover", opacity: 0.1 }}
          />
          {/* 水波底纹 */}
          <img
            src="/fengyuqing/cloud-wave.svg"
            alt=""
            style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "160px", objectFit: "cover", opacity: 0.08 }}
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
