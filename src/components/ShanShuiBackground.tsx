"use client";

import { useEffect } from "react";

export default function ShanShuiBackground() {
  useEffect(() => {
    let mounted = true;

    async function init() {
      // 每次刷新用新 seed 生成不同构图
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
      const url = URL.createObjectURL(blob);

      // 底部对齐，纵向 cover（天空可能被裁），山水主体始终贴底
      document.body.style.backgroundImage = `url("${url}")`;
      document.body.style.backgroundRepeat = "no-repeat";
      document.body.style.backgroundSize = "cover";
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
