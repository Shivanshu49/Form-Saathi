import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ApiFailure, SafeErrorFilter } from '../apps/api/dist/http.js';

// The error filter is the last thing that touches a connection; once the
// caller has gone it must stay silent instead of answering a closed socket.

function host(response: Record<string, unknown>) {
  return { switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({ path: '/v1/test' }) }) } as never;
}

describe('safe error filter', () => {
  it('audit regression: writes nothing to a connection the caller already closed', () => {
    const writes: number[] = [];
    const response = { destroyed: true, writableEnded: false, status: (code: number) => { writes.push(code); return { json: () => undefined }; } };
    new SafeErrorFilter().catch(new ApiFailure(499, 'cancelled', 'The request was cancelled.'), host(response));
    new SafeErrorFilter().catch(new Error('late'), host(response));
    expect(writes).toEqual([]);
  });

  it('still answers a live connection with the bounded shape', () => {
    const sent: unknown[] = [];
    const response = { destroyed: false, writableEnded: false, status: (code: number) => ({ json: (body: unknown) => sent.push([code, body]) }) };
    new SafeErrorFilter().catch(new ApiFailure(499, 'cancelled', 'The request was cancelled.'), host(response));
    expect(sent).toEqual([[499, { error: 'cancelled', message: 'The request was cancelled.', fields: [] }]]);
  });
});
