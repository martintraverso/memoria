import { describeGameRepositoryContract } from '../game-repository.contract-spec';
import { InMemoryGameRepository } from './in-memory-game.repository';

describe('InMemoryGameRepository', () => {
  describeGameRepositoryContract(() => new InMemoryGameRepository());
});
