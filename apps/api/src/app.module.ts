import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AiController } from './ai.controller.js';
import { CONFIG, readConfig, type Config } from './config.js';
import { PilotAuthGuard, RateLimitGuard, SafeErrorFilter } from './http.js';
import { PROVIDER, SarvamProvider } from './provider.js';

@Module({
  controllers: [AppController, AiController],
  providers: [
    { provide: CONFIG, useFactory: () => readConfig() },
    { provide: PROVIDER, useFactory: (config: Config) => new SarvamProvider(config), inject: [CONFIG] },
    // Applied here, not in bootstrap, so every app built from this module —
    // including the integration tests — answers with the same safe shape.
    { provide: APP_FILTER, useClass: SafeErrorFilter },
    PilotAuthGuard,
    RateLimitGuard,
  ],
})
export class AppModule {}
