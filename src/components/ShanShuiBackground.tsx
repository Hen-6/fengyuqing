"use client";

import { useEffect } from "react";
import { shanShuiBackground } from "@/lib/shanshui";

export default function ShanShuiBackground() {
  useEffect(() => {
    // Generate procedural landscape SVG as data URI and set as body background
    const dataUri = shanShuiBackground({
      width: 1440,
      height: 900,
      showSeal: true,
    });

    // Apply directly to body
    document.body.style.backgroundImage = `url("${dataUri}")`;
    document.body.style.backgroundRepeat = "no-repeat";
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center center";
    document.body.style.backgroundAttachment = "fixed";
    document.body.style.backgroundColor = "#f0ebe0";
  }, []);

  return null;
}
