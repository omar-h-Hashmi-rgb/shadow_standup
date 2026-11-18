import { NextResponse } from 'next/server';
import { authenticate, isValidGitHubToken } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { encryptSecret } from '@/lib/crypto';
import { HttpError, handleRouteError, readJsonBody, MAX_BODY_BYTES } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';

/** Persists the signed-in user's GitHub token (encrypted at rest) for server-side use. */
export async function POST(request: Request) {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;
  const limited = enforceRateLimit(request, 'crud', auth.user.id);
  if (limited) return limited;

  try {
    const { token, refresh_token } = await readJsonBody<{ token?: unknown; refresh_token?: unknown }>(
      request,
      MAX_BODY_BYTES.small
    );

    if (typeof token !== 'string' || !isValidGitHubToken(token)) {
      throw new HttpError('Invalid GitHub token format.', 400);
    }
    if (refresh_token !== undefined && refresh_token !== null && (typeof refresh_token !== 'string' || refresh_token.length > 512)) {
      throw new HttpError('Invalid refresh token.', 400);
    }

    const { error } = await getSupabaseAdmin()
      .from('user_tokens')
      .upsert(
        {
          user_id: auth.user.id,
          provider_token: encryptSecret(token),
          provider_refresh_token: refresh_token ? encryptSecret(refresh_token as string) : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'auth-token');
  }
}
