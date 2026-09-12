import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { readConfig } from './config.js';

async function bootstrap() {
  const config = readConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Route mapping only. Request bodies, transcripts and audio are never logged.
    logger: ['error', 'warn', 'log'],
    bodyParser: true,
  });
  // JSON bodies carry field text only; audio arrives as multipart instead.
  app.useBodyParser('json', { limit: '256kb' });
  app.enableShutdownHooks();
  await app.listen(config.port, config.host);
}
await bootstrap();
