import { CryptoIdGenerator } from './crypto-id.generator';

describe('CryptoIdGenerator', () => {
  it('generates distinct UUIDs', () => {
    const generator = new CryptoIdGenerator();
    const ids = new Set(
      Array.from({ length: 100 }, () => generator.generate()),
    );

    expect(ids.size).toBe(100);
    for (const id of ids) {
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
  });
});
