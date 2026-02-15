/**
 * Path Utility Functions
 * OS-agnostic path helpers for handling both Unix and Windows paths
 */

/**
 * Extracts the directory portion of a path (works with both Unix and Windows paths)
 * Similar to path.dirname but works with string paths from Gateway
 */
export function dirnameLike(value: string): string {
  const normalized = String(value || '');
  const lastSlash = normalized.lastIndexOf('/');
  const lastBackslash = normalized.lastIndexOf('\\');
  const idx = Math.max(lastSlash, lastBackslash);
  if (idx < 0) return '';
  return normalized.slice(0, idx);
}

/**
 * Joins directory and filename with appropriate separator
 * Detects separator style from the directory path
 */
export function joinPathLike(dir: string, leaf: string): string {
  const normalizedDir = String(dir || '');
  const normalizedLeaf = String(leaf || '');
  const sep = normalizedDir.includes('\\') ? '\\' : '/';
  const trimmedDir =
    normalizedDir.endsWith('/') || normalizedDir.endsWith('\\')
      ? normalizedDir.slice(0, -1)
      : normalizedDir;
  return `${trimmedDir}${sep}${normalizedLeaf}`;
}
