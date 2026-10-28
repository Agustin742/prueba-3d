import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

  constructor() {
    super(
      process.env.DATABASE_URL
        ? { datasources: { db: { url: process.env.DATABASE_URL } } }
        : { datasources: { db: { url: 'postgresql://localhost:5435/maqueta_3d?schema=public' } } },
    );
  }

  async onModuleInit() {
    if (!this.hasDatabaseUrl) {
      console.warn('[PrismaService] DATABASE_URL not set — running in memory fallback mode for Socket.IO.');
      return;
    }
    try {
      await this.$connect();
      console.log('[PrismaService] Connected to PostgreSQL');
    } catch {
      console.warn('[PrismaService] PostgreSQL not reachable — running in memory fallback mode for Socket.IO.');
    }
  }

  async onModuleDestroy() {
    if (!this.hasDatabaseUrl) return;
    try {
      await this.$disconnect();
    } catch {
      // Ignore disconnect error if never connected
    }
  }
}
