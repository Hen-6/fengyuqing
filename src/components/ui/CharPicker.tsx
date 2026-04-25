"use client";

import { FEIHUA_CHARS } from "@/lib/poems";

interface CharPickerProps {
  selected: string;
  onSelect: (char: string) => void;
  disabled?: boolean;
}

export function CharPicker({ selected, onSelect, disabled }: CharPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {FEIHUA_CHARS.map((char) => (
        <button
          key={char}
          onClick={() => onSelect(char)}
          disabled={disabled}
          className={`
            flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold
            transition-all duration-150
            ${selected === char
              ? "bg-accent text-white shadow-md scale-105"
              : "bg-surface border border-border text-ink hover:border-accent hover:text-accent"
            }
            ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
          `}
        >
          {char}
        </button>
      ))}
    </div>
  );
}
