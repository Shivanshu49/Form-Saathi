import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { z } from 'zod';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const port = z.coerce.number().int().min(1).max(65535).parse(process.env.PORT ?? 3000);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableShutdownHooks();
  await app.listen(port, process.env.HOST ?? '127.0.0.1');
}
await bootstrap();
