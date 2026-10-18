import type { Shuffler } from '../../application/ports/outbound/shuffler.port';

export class FisherYatesShuffler implements Shuffler {
  constructor(private readonly random: () => number = Math.random) {}

  shuffle<T>(items: readonly T[]): T[] {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(this.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [
        shuffled[randomIndex],
        shuffled[index],
      ];
    }
    return shuffled;
  }
}
