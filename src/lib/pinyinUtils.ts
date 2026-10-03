import { pinyin } from "pinyin-pro";

export const getCleanPinyin = (str: string) => {
  try {
    return pinyin(str, { toneType: "none", type: "array" })
      .map(p => p.toLowerCase().replace(/[^a-z0-9]/g, ""))
      .join("");
  } catch (e) {
    return "";
  }
};

export const matchPinyin = (a: string, b: string) => {
  const pA = getCleanPinyin(a);
  const pB = getCleanPinyin(b);
  return pA && pB && pA === pB;
};
