import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Liveness for the container healthcheck (`docs/usage.md` → Deploy): the
 * process is up and serving requests. Deliberately touches neither store, so a
 * database outage shows as Planner 503s in the logs rather than a restart loop,
 * and an unauthenticated caller learns nothing about the backends.
 */
export function GET() {
  return NextResponse.json({ status: 'ok' }, { headers: { 'cache-control': 'no-store' } });
}
