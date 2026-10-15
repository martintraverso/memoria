import type { Namespace } from 'socket.io';

/**
 * Holds the `/game` namespace once Nest has created it. The gateway attaches
 * it in `afterInit`; outbound socket adapters read it. This avoids a
 * dependency cycle (gateway → use cases → events → gateway).
 */
export class SocketServerRef {
  private namespace?: Namespace;

  attach(namespace: Namespace): void {
    this.namespace = namespace;
  }

  get(): Namespace {
    if (!this.namespace) {
      throw new Error('The /game Socket.IO namespace is not initialized yet.');
    }
    return this.namespace;
  }
}
