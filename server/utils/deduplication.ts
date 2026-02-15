/**
 * Deduplication Service
 * Tracks seen lines per runId to prevent duplicate rendering
 */

export class DeduplicationService {
  private seenLines: Map<string, Set<string>> = new Map();

  /**
   * Check if a line has been seen for a given runId
   */
  hasSeen(runId: string, line: string): boolean {
    const runSet = this.seenLines.get(runId);
    if (!runSet) return false;
    
    // Create a hash of the line for comparison
    const hash = this.hashLine(line);
    return runSet.has(hash);
  }

  /**
   * Mark a line as seen for a given runId
   */
  markSeen(runId: string, line: string): void {
    let runSet = this.seenLines.get(runId);
    if (!runSet) {
      runSet = new Set();
      this.seenLines.set(runId, runSet);
    }
    
    const hash = this.hashLine(line);
    runSet.add(hash);
  }

  /**
   * Check and mark in one operation (returns true if new, false if duplicate)
   */
  checkAndMark(runId: string, line: string): boolean {
    if (this.hasSeen(runId, line)) {
      return false; // Duplicate
    }
    this.markSeen(runId, line);
    return true; // New
  }

  /**
   * Clear all seen lines for a runId (call when run completes)
   */
  clearRun(runId: string): void {
    this.seenLines.delete(runId);
  }

  /**
   * Clear all data (useful for cleanup/reset)
   */
  clear(): void {
    this.seenLines.clear();
  }

  /**
   * Get number of tracked runs
   */
  getTrackedRunsCount(): number {
    return this.seenLines.size;
  }

  /**
   * Create a simple hash of a line
   */
  private hashLine(line: string): string {
    // Simple hash function - could be replaced with a more sophisticated one
    let hash = 0;
    for (let i = 0; i < line.length; i++) {
      const char = line.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }
}

// Export singleton instance
export const deduplicationService = new DeduplicationService();
