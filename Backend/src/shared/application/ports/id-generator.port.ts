export interface IdGenerator {
  generate(): string;
}

export const ID_GENERATOR = Symbol('ID_GENERATOR');
