import { Logger, OnModuleDestroy } from '@nestjs/common';
import type { MismatchScheduler } from '../../../application/ports/outbound/mismatch-scheduler.port';

/** In-process timers, one per room. All pending timers die on shutdown. */
export class TimeoutMismatchScheduler
  implements MismatchScheduler, OnModuleDestroy
{
  private readonly logger = new Logger(TimeoutMismatchScheduler.name);
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  schedule(roomCode: string, delayMs: number, task: () => void): void {
    this.cancel(roomCode);
    const timer = setTimeout(() => {
      this.timers.delete(roomCode);
      try {
        task();
      } catch (error) {
        // An exception here would escape the timer and crash the process.
        this.logger.error(
          `Mismatch resolution failed for room ${roomCode}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }, delayMs);
    this.timers.set(roomCode, timer);
  }

  onModuleDestroy(): void {
    for (const roomCode of [...this.timers.keys()]) {
      this.cancel(roomCode);
    }
  }

  private cancel(roomCode: string): void {
    const timer = this.timers.get(roomCode);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(roomCode);
    }
  }
}
