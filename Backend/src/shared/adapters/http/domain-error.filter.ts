import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ConflictError,
  DomainError,
  InvalidInputError,
  NotFoundError,
} from '../../domain/errors';

/**
 * Maps domain errors to the same JSON body Nest's HTTP exceptions produce:
 * `{ statusCode, error, message }`.
 */
@Catch(DomainError)
export class DomainErrorHttpFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost): void {
    const exception = toHttpException(error);
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(exception.getStatus())
      .json(exception.getResponse());
  }
}

export function toHttpException(error: DomainError): HttpException {
  if (error instanceof InvalidInputError) {
    return new BadRequestException(error.message);
  }
  if (error instanceof ConflictError) {
    return new ConflictException(error.message);
  }
  if (error instanceof NotFoundError) {
    return new NotFoundException(error.message);
  }
  throw new Error(`Unmapped domain error: ${error.name}`);
}
