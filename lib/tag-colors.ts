export const FALLBACK_TAG_COLOR = '#64748b';

function normalizeHex(color?: string): string {
  const value = (color || '').trim();
  const match = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(value);
  if (!match) {
    return FALLBACK_TAG_COLOR;
  }

  const hex = match[1];
  if (hex.length === 3) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toLowerCase();
  }

  return `#${hex.toLowerCase()}`;
}

function hexToRgb(hexColor: string): { red: number; green: number; blue: number } {
  const normalized = normalizeHex(hexColor).slice(1);
  return {
    red: parseInt(normalized.slice(0, 2), 16),
    green: parseInt(normalized.slice(2, 4), 16),
    blue: parseInt(normalized.slice(4, 6), 16),
  };
}

export function asRgba(hexColor: string | undefined, alpha: number): string {
  const { red, green, blue } = hexToRgb(hexColor || FALLBACK_TAG_COLOR);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function getTagColor(tag: string, tagColors?: Record<string, string>): string {
  return normalizeHex(tagColors?.[tag]);
}
