import { NextResponse } from 'next/server';
<<<<<<< HEAD
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
=======
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { token, refresh_token } = await request.json();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session || !token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Persist token for this user
    const { error } = await supabaseAdmin
      .from('user_tokens')
      .upsert({
        user_id: session.user.id,
        provider_token: token,
        provider_refresh_token: refresh_token,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Token Store Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
>>>>>>> origin/main
  }
}
