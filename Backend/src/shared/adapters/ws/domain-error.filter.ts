import { ArgumentsHost, Catch } from '@nestjs/common';
import type { WsExceptionFilter } from '@nestjs/common';
import type { Socket } from 'socket.io';
import { DomainError } from '../../domain/errors';

/**
 * Emits the same `exception` payload as Nest's default WS filter does for
 * non-WsException errors, but without logging: domain errors are expected
 * rule violations, not crashes.
 *
 * The message is generic on purpose to keep the current protocol. Sending
 * `error.message` instead is a pending product decision
 * (docs/hexagonal-refactor-plan.md, section 6).
 */
@Catch(DomainError)
export class DomainErrorWsFilter implements WsExceptionFilter<DomainError> {
  catch(_error: DomainError, host: ArgumentsHost): void {
    const ws = host.switchToWs();
    ws.getClient<Socket>().emit('exception', {
      status: 'error',
      message: 'Internal server error',
      cause: { pattern: ws.getPattern(), data: ws.getData<unknown>() },
    });
  }
}
