import { Module } from '@nestjs/common';
import { CryptoIdGenerator } from './adapters/crypto-id.generator';
import { ID_GENERATOR } from './application/ports/id-generator.port';

/** Adapters for the ports every feature uses. */
@Module({
  providers: [
    { provide: ID_GENERATOR, useFactory: () => new CryptoIdGenerator() },
  ],
  exports: [ID_GENERATOR],
})
export class SharedModule {}
