import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { handleRouteError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { assertUuid } from '@/lib/validation';

// Every query is scoped to the authenticated user's id — the id is never taken from the client.

export async function GET(request: Request) {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;
  const limited = enforceRateLimit(request, 'crud', auth.user.id);
  if (limited) return limited;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('code_reviews')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return NextResponse.json({ success: true, reviews: data || [] });
  } catch (error) {
    return handleRouteError(error, 'code-review-history');
  }
}

export async function DELETE(request: Request) {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;
  const limited = enforceRateLimit(request, 'crud', auth.user.id);
  if (limited) return limited;

  try {
    const id = assertUuid(new URL(request.url).searchParams.get('id'));
    const { error } = await getSupabaseAdmin()
      .from('code_reviews')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.user.id); // ownership check: users can only delete their own rows
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'code-review-history');
  }
}
