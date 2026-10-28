import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { RoomsModule } from './rooms/rooms.module';

@Module({
  imports: [PrismaModule, RoomsModule],
})
export class AppModule {}
