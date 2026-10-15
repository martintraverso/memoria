import {
  ConflictError,
  DomainError,
  InvalidInputError,
  NotFoundError,
} from './errors';

describe('domain errors', () => {
  it.each([InvalidInputError, ConflictError, NotFoundError])(
    '%p is a DomainError that keeps its message and class name',
    (ErrorClass) => {
      const error = new ErrorClass('La sala no existe.');

      expect(error).toBeInstanceOf(DomainError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('La sala no existe.');
      expect(error.name).toBe(ErrorClass.name);
    },
  );
});
