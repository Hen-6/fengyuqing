"use client";

import { useEffect } from "react";

export default function ShanShuiBackground() {
  useEffect(() => {
    let mounted = true;

    async function init() {
      const seed = Date.now();
      const { PaintingGenerator } = await import("@jobinjia/shuimo-core");
      if (!mounted) return;

      const W = window.innerWidth;
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
      const url = URL.createObjectURL(blob);

      // auto 80vh = 高度固定为视口80%，宽度等比缩放
      // center bottom = 图片底部与容器底部对齐（山水画地平线贴底）
      document.body.style.backgroundImage = `url("${url}")`;
      document.body.style.backgroundRepeat = "no-repeat";
      document.body.style.backgroundSize = "auto 80vh";
      document.body.style.backgroundPosition = "center bottom";
      document.body.style.backgroundAttachment = "fixed";
      document.body.style.backgroundColor = "#f0ebe0";
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  return null;
}
