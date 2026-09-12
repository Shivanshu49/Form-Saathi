import { createHash } from 'node:crypto';
import {
  HttpException,
  Inject,
  Injectable,
  type ArgumentsHost,
  type CanActivate,
  type ExceptionFilter,
  type ExecutionContext,
  type PipeTransform,
} from '@nestjs/common';
import { Catch } from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { apiErrorSchema, type ApiError } from '@form-saathi/contracts';
import { CONFIG, type Config } from './config.js';
import { verifyPilotToken, type PilotToken } from './pilot-token.js';

// Request validation, pilot authentication, rate limiting and safe errors.
// Nothing here logs a body, a transcript, an audio buffer or a credential.

export class ApiFailure extends HttpException {
  constructor(status: number, error: ApiError['error'], message: string, fields: string[] = []) {
    super({ error, message, fields } satisfies ApiError, status);
  }
}

/** Validates one request body against a contract, reporting paths only. */
export class ZodBodyPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw new ApiFailure(
      400,
      'invalid_request',
      'The request body did not match the contract.',
      // Paths, never values: a rejected body may hold what someone typed.
      [...new Set(result.error.issues.map((issue) => issue.path.join('.') || '(body)'))].slice(0, 20),
    );
  }
}

type PilotRequest = Request & { pilot?: PilotToken };

@Injectable()
export class PilotAuthGuard implements CanActivate {
  constructor(@Inject(CONFIG) private readonly config: Config) {}

  canActivate(context: ExecutionContext): boolean {
    // Without a signing secret the service stays closed rather than open.
    if (this.config.pilotSecret === undefined) {
      throw new ApiFailure(503, 'service_not_configured', 'This deployment has no pilot credentials configured.');
    }
    const request = context.switchToHttp().getRequest<PilotRequest>();
    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
    const pilot = token === '' ? null : verifyPilotToken(token, this.config.pilotSecret);
    if (pilot === null) {
      throw new ApiFailure(401, 'unauthorized', 'A valid, unexpired pilot credential is required.');
    }
    request.pilot = pilot;
    return true;
  }
}

type Window = { count: number; resetAt: number };

/**
 * Fixed window per credential, falling back to the client address before a
 * credential is verified. In memory, so it bounds one process, not a cluster.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, Window>();

  constructor(@Inject(CONFIG) private readonly config: Config) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<PilotRequest>();
    const header = request.headers.authorization ?? '';
    // Hashed: a raw credential never sits in a map key or an error.
    const caller = header === ''
      ? request.ip ?? 'unknown'
      : createHash('sha256').update(header).digest('hex').slice(0, 16);
    const key = `${caller}:${request.path}`;
    const now = Date.now();
    for (const [candidate, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(candidate);
    }
    const window = this.windows.get(key) ?? { count: 0, resetAt: now + 60_000 };
    window.count += 1;
    this.windows.set(key, window);
    if (window.count > this.config.rateLimitPerMinute) {
      throw new ApiFailure(429, 'rate_limited', 'Too many requests. Wait a minute and try again.');
    }
    return true;
  }
}

const STATUS_ERRORS: Record<number, ApiError['error']> = {
  400: 'invalid_request',
  401: 'unauthorized',
  403: 'unauthorized',
  404: 'not_found',
  413: 'payload_too_large',
  415: 'unsupported_media',
  429: 'rate_limited',
  499: 'cancelled',
  502: 'provider_unavailable',
  503: 'service_not_configured',
};

const STATUS_MESSAGES: Record<number, string> = {
  400: 'The request did not match the contract.',
  401: 'A valid, unexpired pilot credential is required.',
  403: 'A valid, unexpired pilot credential is required.',
  404: 'No such endpoint.',
  413: 'The upload is larger than this service accepts.',
  415: 'That audio format is not supported.',
  429: 'Too many requests. Wait a minute and try again.',
  499: 'The request was cancelled.',
  502: 'The language service is unavailable.',
  503: 'This service is not configured for that request.',
};

/**
 * Every failure leaves as one bounded shape. Provider bodies, stack traces,
 * environment values and credentials never reach a client or a log line.
 */
@Catch()
export class SafeErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const known = exception instanceof HttpException
      ? apiErrorSchema.safeParse(exception.getResponse())
      : null;
    const body: ApiError = known?.success === true ? known.data : {
      error: STATUS_ERRORS[status] ?? 'internal',
      message: STATUS_MESSAGES[status] ?? 'The service could not complete that request.',
      fields: [],
    };
    if (status >= 500 && !(exception instanceof HttpException)) {
      // Class and status only: never the message, which may quote a request.
      console.error(`Unhandled ${exception instanceof Error ? exception.name : 'error'} on ${host.switchToHttp().getRequest<Request>().path}`);
    }
    response.status(status).json(body);
  }
}
