import { io, Socket } from 'socket.io-client';
import type { AvatarConfiguration } from '../avatar/AvatarCustomizer';

export interface PlayerState {
  appearance?: AvatarConfiguration;
  id: string;
  roomCode: string;
  nickname: string;
  position: [number, number, number];
  rotation: number;
  animation: string;
}

export interface ChatMessage {
  id?: string;
  sender: string;
  content: string;
  createdAt?: string;
  isSystem?: boolean;
}

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export const socket: Socket = io(SERVER_URL, {
  autoConnect: false,
});
