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
import { parsePilotCredential, verifyPilotToken, type PilotToken } from './pilot-token.js';

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

type Window = { count: number; resetAt: number };
const MAX_WINDOWS = 10_000;

/** Lazy expiry and a hard cap: never evict a live allowance to admit a new key. */
function consume(windows: Map<string, Window>, key: string, limit: number): void {
  const now = Date.now();
  // ponytail: bounded linear sweep in one process; use a shared limiter for a cluster.
  for (const [candidate, window] of windows) {
    if (window.resetAt <= now) windows.delete(candidate);
  }
  let window = windows.get(key);
  if (!window && windows.size < MAX_WINDOWS) {
    window = { count: 0, resetAt: now + 60_000 };
    windows.set(key, window);
  }
  if (!window || window.count >= limit) {
    throw new ApiFailure(429, 'rate_limited', 'Too many requests. Wait a minute and try again.');
  }
  window.count += 1;
}

@Injectable()
export class PilotAuthGuard implements CanActivate {
  private readonly attempts = new Map<string, Window>();

  constructor(@Inject(CONFIG) private readonly config: Config) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<PilotRequest>();
    // No forwarded headers or unverified tokens select a bucket. This app has
    // no trusted-proxy configuration, so use the actual socket peer only.
    consume(this.attempts, request.socket.remoteAddress ?? 'unknown', this.config.preAuthRateLimitPerMinute);
    // Without a signing secret the service stays closed rather than open.
    if (this.config.pilotSecret === undefined) {
      throw new ApiFailure(503, 'service_not_configured', 'This deployment has no pilot credentials configured.');
    }
    const token = parsePilotCredential(request.headers.authorization);
    const pilot = token === null ? null : verifyPilotToken(token, this.config.pilotSecret);
    if (pilot === null) {
      throw new ApiFailure(401, 'unauthorized', 'A valid, unexpired pilot credential is required.');
    }
    request.pilot = pilot;
    return true;
  }
}

/**
 * Fixed window per verified pilot identity and route. Renewing or reformatting
 * a credential cannot create another allowance for the same identity.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, Window>();

  constructor(@Inject(CONFIG) private readonly config: Config) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<PilotRequest>();
    if (!request.pilot) throw new ApiFailure(401, 'unauthorized', 'A verified pilot identity is required.');
    const caller = createHash('sha256').update(request.pilot.subject).digest('hex');
    // The handler is stable even if Express accepts a differently cased path.
    consume(this.windows, `${caller}:${context.getHandler().name}`, this.config.rateLimitPerMinute);
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
    // The caller has gone, or was answered already: nothing is written to a
    // closed connection, so a cancellation never turns into a second reply.
    if (response.destroyed || response.writableEnded) return;
    response.status(status).json(body);
  }
}
