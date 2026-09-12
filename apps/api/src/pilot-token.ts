import { createHmac, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Expiring pilot credentials for a shared deployment. Each participant gets
// their own short-lived token; the extension never ships one, and there is no
// shared permanent credential to leak. Tokens carry no personal data.

const PREFIX = 'fs1';

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function mintPilotToken(subject: string, hours: number, secret: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + Math.round(hours * 3600);
  const payload = Buffer.from(JSON.stringify({ sub: subject, exp: expiresAt })).toString('base64url');
  return `${PREFIX}.${payload}.${sign(payload, secret)}`;
}

export type PilotToken = { subject: string; expiresAt: number };

/** HTTP scheme/spacing are transport syntax, never part of a credential. */
export function parsePilotCredential(header: string | undefined): string | null {
  return /^Bearer[ \t]+(\S+)[ \t]*$/i.exec(header ?? '')?.[1] ?? null;
}

/** Returns null for anything that is not a currently valid token. */
export function verifyPilotToken(token: string, secret: string, now = Date.now()): PilotToken | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  const [, payload, signature] = parts as [string, string, string];
  const expected = Buffer.from(sign(payload, secret));
  const supplied = Buffer.from(signature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof claims !== 'object' || claims === null) return null;
    const { sub, exp } = claims as { sub?: unknown; exp?: unknown };
    if (typeof sub !== 'string' || sub.length === 0 || typeof exp !== 'number' || !Number.isSafeInteger(exp)) return null;
    if (exp * 1000 <= now) return null;
    return { subject: sub, expiresAt: exp };
  } catch {
    return null;
  }
}

// Minting is an operator task: node dist/pilot-token.js <subject> <hours>
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [subject, hours] = process.argv.slice(2);
  const secret = process.env['PILOT_TOKEN_SECRET'];
  if (!subject || !secret) {
    console.error('Usage: PILOT_TOKEN_SECRET=<secret> node dist/pilot-token.js <subject> [hours]');
    process.exit(2);
  }
  console.log(mintPilotToken(subject, Number(hours ?? 8), secret));
}
