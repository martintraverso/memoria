import { describeRoomRepositoryContract } from '../room-repository.contract-spec';
import { InMemoryRoomRepository } from './in-memory-room.repository';

describe('InMemoryRoomRepository', () => {
  describeRoomRepositoryContract(() => new InMemoryRoomRepository());
});
