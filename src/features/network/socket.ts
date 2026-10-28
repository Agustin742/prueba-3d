import { io, Socket } from 'socket.io-client';

export interface PlayerState {
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
}

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export const socket: Socket = io(SERVER_URL, {
  autoConnect: false,
});

