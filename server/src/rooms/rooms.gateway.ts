import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RoomsService } from './rooms.service';

interface PlayerState {
  id: string;
  roomCode: string;
  nickname: string;
  position: [number, number, number];
  rotation: number;
  animation: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private players = new Map<string, PlayerState>();

  constructor(private readonly roomsService: RoomsService) {}

  handleConnection(client: Socket) {
    // client connected
  }

  handleDisconnect(client: Socket) {
    const player = this.players.get(client.id);
    if (player) {
      this.players.delete(client.id);
      this.server.to(player.roomCode).emit('player-left', { id: client.id });
    }
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomCode: string;
      nickname: string;
      position?: [number, number, number];
      rotation?: number;
    },
  ) {
    const roomCode = data.roomCode?.trim() || 'global';
    const nickname = data.nickname?.trim() || `Player-${client.id.slice(0, 4)}`;

    await this.roomsService.getOrCreateRoom(roomCode);

    client.join(roomCode);

    const playerState: PlayerState = {
      id: client.id,
      roomCode,
      nickname,
      position: data.position || [0.25, 0, 1.55],
      rotation: data.rotation || 0,
      animation: 'idle',
    };
    this.players.set(client.id, playerState);

    // List other players already in this room
    const existingPlayers = Array.from(this.players.values()).filter(
      (p) => p.roomCode === roomCode && p.id !== client.id,
    );

    // Fetch recent chat messages from DB
    const messages = await this.roomsService.getMessages(roomCode);

    // Send init packet to the joining client
    client.emit('room-joined', {
      self: playerState,
      players: existingPlayers,
      messages,
    });

    // Notify other clients in the room
    client.to(roomCode).emit('player-joined', playerState);
  }

  @SubscribeMessage('player-move')
  handlePlayerMove(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      position: [number, number, number];
      rotation: number;
      animation: string;
    },
  ) {
    const player = this.players.get(client.id);
    if (!player) return;

    player.position = data.position;
    player.rotation = data.rotation;
    player.animation = data.animation;

    client.to(player.roomCode).emit('player-moved', {
      id: client.id,
      position: data.position,
      rotation: data.rotation,
      animation: data.animation,
    });
  }

  @SubscribeMessage('chat-message')
  async handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { content: string },
  ) {
    const player = this.players.get(client.id);
    if (!player || !data.content?.trim()) return;

    const saved = await this.roomsService.saveMessage(
      player.roomCode,
      player.nickname,
      data.content.trim(),
    );

    this.server.to(player.roomCode).emit('chat-message', {
      id: saved.id,
      sender: player.nickname,
      content: saved.content,
      createdAt: saved.createdAt,
    });
  }
}
