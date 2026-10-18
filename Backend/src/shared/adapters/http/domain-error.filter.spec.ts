import type { ArgumentsHost } from '@nestjs/common';
import {
  ConflictError,
  DomainError,
  InvalidInputError,
  NotFoundError,
} from '../../domain/errors';
import { DomainErrorHttpFilter } from './domain-error.filter';

describe('DomainErrorHttpFilter', () => {
  function catchWith(error: DomainError): {
    status: jest.Mock;
    json: jest.Mock;
  } {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;

    new DomainErrorHttpFilter().catch(error, host);
    return { status, json };
  }

  it.each([
    [new InvalidInputError('Dato inválido.'), 400, 'Bad Request'],
    [new ConflictError('Conflicto.'), 409, 'Conflict'],
    [new NotFoundError('No existe.'), 404, 'Not Found'],
  ])(
    'maps %p to %i with the Nest error body',
    (error, statusCode, errorName) => {
      const { status, json } = catchWith(error);

      expect(status).toHaveBeenCalledWith(statusCode);
      expect(json).toHaveBeenCalledWith({
        statusCode,
        error: errorName,
        message: error.message,
      });
    },
  );

  it('fails loudly for a domain error without an HTTP mapping', () => {
    class UnmappedError extends DomainError {}

    expect(() => catchWith(new UnmappedError('x'))).toThrow(
      'Unmapped domain error: UnmappedError',
    );
  });
});
