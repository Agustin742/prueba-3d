import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { corsOrigin } from './cors-origin';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: corsOrigin,
  });
  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`[NestJS Server] running on http://localhost:${port}`);
}
bootstrap();
