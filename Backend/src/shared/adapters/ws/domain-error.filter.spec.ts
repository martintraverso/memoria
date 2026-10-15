import type { ArgumentsHost } from '@nestjs/common';
import { ConflictError } from '../../domain/errors';
import { DomainErrorWsFilter } from './domain-error.filter';

describe('DomainErrorWsFilter', () => {
  it('emits the generic exception payload with the request as cause', () => {
    const emit = jest.fn();
    const data = { roomCode: 'ABC234', playerId: 'p1', cardId: 'c1' };
    const host = {
      switchToWs: () => ({
        getClient: () => ({ emit }),
        getPattern: () => 'card.flip.request',
        getData: () => data,
      }),
    } as unknown as ArgumentsHost;

    new DomainErrorWsFilter().catch(
      new ConflictError('No es el turno del jugador.'),
      host,
    );

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('exception', {
      status: 'error',
      message: 'Internal server error',
      cause: { pattern: 'card.flip.request', data },
    });
  });
});
