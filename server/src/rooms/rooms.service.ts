import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateRoom(code: string, name?: string) {
    const existing = await this.prisma.room.findUnique({
      where: { code },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.room.create({
      data: {
        code,
        name: name || `Room ${code}`,
      },
    });
  }

  async getMessages(roomCode: string, limit = 50) {
    const room = await this.getOrCreateRoom(roomCode);
    return this.prisma.message.findMany({
      where: { roomId: room.id },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async saveMessage(roomCode: string, sender: string, content: string) {
    const room = await this.getOrCreateRoom(roomCode);
    return this.prisma.message.create({
      data: {
        roomId: room.id,
        sender,
        content,
      },
    });
  }
}
