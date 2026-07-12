import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { runtimeConfig } from '../config/runtime-config';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private readonly socket: Socket;

  constructor() {
    this.socket = io(`${runtimeConfig.wsBaseUrl}/game`, {
      transports: ['websocket'],
      withCredentials: true,
    });
  }

  emit<T>(eventName: string, payload: T): void {
    this.socket.emit(eventName, payload);
  }

  on<T>(eventName: string, handler: (payload: T) => void): void {
    this.socket.on(eventName, handler);
  }

  off(eventName: string): void {
    this.socket.off(eventName);
  }

  disconnect(): void {
    this.socket.disconnect();
  }

  get isConnected(): boolean {
    return this.socket.connected;
  }
}
