import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { getTeamsStatus, postToTeams } from '@/lib/teams';
import { formatTeamsTestMessage } from '@/lib/platform-adapter';
import { jsonError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';

/** Sends a one-off test card to the Teams webhook configured in TEAMS_WEBHOOK_URL. */
export async function POST(request: Request) {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;
  const limited = enforceRateLimit(request, 'notifyTest', auth.user.id);
  if (limited) return limited;

  const status = getTeamsStatus();
  if (!status.configured) {
    return jsonError(
      status.reason === 'invalid'
        ? 'TEAMS_WEBHOOK_URL is set but is not a recognised Teams Workflows webhook URL.'
        : 'Microsoft Teams is not configured. Set TEAMS_WEBHOOK_URL on the server.',
      400
    );
  }

  const result = await postToTeams(formatTeamsTestMessage());
  if (!result.ok) {
    return jsonError(
      `Teams did not accept the message${result.status ? ` (HTTP ${result.status})` : ''}. Check the workflow in Power Automate.`,
      502
    );
  }
  return NextResponse.json({ success: true, status: result.status });
}
