import { NextResponse } from 'next/server';

// Liveness for the load balancer and the container health check. Deliberately
// does not call the API: a slow API must not get healthy web tasks replaced.
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ status: 'ok' });
}
