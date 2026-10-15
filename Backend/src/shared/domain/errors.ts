/**
 * Base class for business rule violations. Messages are user-facing (Spanish).
 * Adapters translate each subclass to their protocol (HTTP status, WS event).
 */
export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** The request is malformed or breaks an input rule (HTTP 400). */
export class InvalidInputError extends DomainError {}

/** The request is valid but conflicts with the current state (HTTP 409). */
export class ConflictError extends DomainError {}

/** The requested entity does not exist (HTTP 404). */
export class NotFoundError extends DomainError {}
