export const CATEGORY_COLOR_PALETTE = [
  "#1E7FA8", "#6366F1", "#F59E0B", "#6B7280",
  "#10B981", "#EF4444", "#8B5CF6", "#EC4899",
  "#14B8A6", "#F97316", "#84CC16", "#06B6D4",
  "#A855F7", "#DC2626", "#0EA5E9", "#D946EF",
];

export function getNextAvailableColor(usedColors: string[]): string {
  const usedSet = new Set(usedColors.map((c) => c.toUpperCase()));
  const available = CATEGORY_COLOR_PALETTE.find((c) => !usedSet.has(c.toUpperCase()));
  if (available) return available;

  // Fallback: random HSL color
  const hue = Math.floor(Math.random() * 360);
  const s = 65, l = 50;
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    const color = l / 100 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}
