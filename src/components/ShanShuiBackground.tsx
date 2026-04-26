"use client";

import { useEffect, useRef } from "react";

export default function ShanShuiBackground() {
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let mounted = true;
    let objectUrl: string | undefined;

    async function init() {
      const seed = Date.now();
      const { PaintingGenerator } = await import("@jobinjia/shuimo-core");
      if (!mounted) return;

      const W = 1440;
      const H = 900;

      const result = PaintingGenerator.landscape({
        width: W,
        height: H,
        seed,
        onXuanPaper: false,
        transparent: true,
        blankPosition: "none",
        minCounts: { mount: 6, flatmount: 3, arch01: 2, arch03: 1 },
      });

      if (!mounted) return;

      const blob = new Blob([result.svg], { type: "image/svg+xml" });
      objectUrl = URL.createObjectURL(blob);

      if (imgRef.current) {
        imgRef.current.src = objectUrl;
      }
    }

    init();

    return () => {
      mounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  return (
    <img
      ref={imgRef}
      alt=""
      aria-hidden="true"
      style={{
        position: "fixed",
        // 画面从顶部往下 25% 处开始，向下延伸到底
        top: "25%",
        left: 0,
        right: 0,
        // 高度 = 75vh，这样底部刚好到达屏幕底部
        height: "75vh",
        width: "100%",
        objectFit: "cover",
        // 横向居中裁切
        objectPosition: "center top",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}
