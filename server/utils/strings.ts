/**
 * String Utility Functions
 * String formatting and sanitization helpers
 */

/**
 * Converts an agent name to a URL-safe slug
 * Used for creating workspace directory names
 */
export function slugifyAgentName(name: string): string {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
