import { Logger } from '@nestjs/common';
import { TimeoutMismatchScheduler } from './timeout-mismatch-scheduler';

describe('TimeoutMismatchScheduler', () => {
  let scheduler: TimeoutMismatchScheduler;

  beforeEach(() => {
    jest.useFakeTimers();
    scheduler = new TimeoutMismatchScheduler();
  });

  afterEach(() => {
    scheduler.onModuleDestroy();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('runs the task once after the delay', () => {
    const task = jest.fn();

    scheduler.schedule('ABC234', 1000, task);
    jest.advanceTimersByTime(999);
    expect(task).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(task).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(5000);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('replaces the pending task when the same room is scheduled again', () => {
    const first = jest.fn();
    const second = jest.fn();

    scheduler.schedule('ABC234', 1000, first);
    jest.advanceTimersByTime(500);
    scheduler.schedule('ABC234', 1000, second);
    jest.advanceTimersByTime(999);

    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('keeps rooms independent', () => {
    const roomA = jest.fn();
    const roomB = jest.fn();

    scheduler.schedule('AAAAAA', 1000, roomA);
    scheduler.schedule('BBBBBB', 1000, roomB);
    jest.advanceTimersByTime(1000);

    expect(roomA).toHaveBeenCalledTimes(1);
    expect(roomB).toHaveBeenCalledTimes(1);
  });

  it('cancels every pending task on shutdown', () => {
    const task = jest.fn();
    scheduler.schedule('AAAAAA', 1000, task);
    scheduler.schedule('BBBBBB', 1000, task);

    scheduler.onModuleDestroy();
    jest.advanceTimersByTime(5000);

    expect(task).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('logs a failing task instead of letting it crash the process', () => {
    const logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    scheduler.schedule('ABC234', 1000, () => {
      throw new Error('disk full');
    });

    expect(() => jest.advanceTimersByTime(1000)).not.toThrow();
    expect(logError).toHaveBeenCalledWith(
      'Mismatch resolution failed for room ABC234',
      expect.stringContaining('disk full'),
    );
  });
});
