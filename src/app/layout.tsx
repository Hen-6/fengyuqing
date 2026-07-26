import "./globals.css";
import ShanShuaiBackground from "@/components/ShanShuiBackground";
import { Providers } from "@/components/Providers";

import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "风雨情",
  description: "古诗词练习平台 — 飞花令、接龙、寻花令",
  appleWebApp: {
    capable: true,
    title: "风雨情",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hans">
      <body>
        <Providers>
          <ShanShuaiBackground />
          <div style={{ position: "relative", zIndex: 1 }}>
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
