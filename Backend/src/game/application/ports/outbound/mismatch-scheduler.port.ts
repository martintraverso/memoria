export interface MismatchScheduler {
  /**
   * Runs `task` once after `delayMs`. Scheduling the same room again cancels
   * the task that is still pending for it.
   */
  schedule(roomCode: string, delayMs: number, task: () => void): void;
}

export const MISMATCH_SCHEDULER = Symbol('MISMATCH_SCHEDULER');
