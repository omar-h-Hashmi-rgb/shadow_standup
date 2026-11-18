import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { getTeamsStatus } from '@/lib/teams';
import { enforceRateLimit } from '@/lib/rate-limit';

/**
 * Reports which server-configured integrations are active. Returns booleans
 * only — webhook URLs and other secrets never leave the server.
 */
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;
  const limited = enforceRateLimit(request, 'crud', auth.user.id);
  if (limited) return limited;

  return NextResponse.json({ success: true, teams: getTeamsStatus() });
}
