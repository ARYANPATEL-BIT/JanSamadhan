import type { Category } from "@/lib/pipeline/types";

/** Human labels + emoji for the citizen-facing category chips/pickers. */
export const CATEGORY_META: Record<Category, { label: string; emoji: string }> = {
  pothole: { label: "Pothole", emoji: "🕳️" },
  garbage_dump: { label: "Garbage dump", emoji: "🗑️" },
  streetlight_out: { label: "Streetlight out", emoji: "💡" },
  waterlogging: { label: "Waterlogging", emoji: "🌊" },
  broken_footpath: { label: "Broken footpath", emoji: "🚧" },
  open_drain: { label: "Open drain", emoji: "🕳️" },
  illegal_dumping: { label: "Illegal dumping", emoji: "♻️" },
  damaged_signage: { label: "Damaged signage", emoji: "🚏" },
  fallen_tree: { label: "Fallen tree", emoji: "🌳" },
  stray_animal: { label: "Stray animal", emoji: "🐕" },
  other: { label: "Other", emoji: "❓" },
};

export function categoryLabel(c: string): string {
  return CATEGORY_META[c as Category]?.label ?? c;
}

export function categoryEmoji(c: string): string {
  return CATEGORY_META[c as Category]?.emoji ?? "📍";
}
