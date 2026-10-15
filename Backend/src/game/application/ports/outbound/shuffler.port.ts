export interface Shuffler {
  /** Returns a new array with the same items in random order. */
  shuffle<T>(items: readonly T[]): T[];
}

export const SHUFFLER = Symbol('SHUFFLER');
