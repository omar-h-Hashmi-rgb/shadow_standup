import { NextResponse } from 'next/server';
<<<<<<< HEAD
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
=======
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('code_reviews')
      .select('*')
      .eq('user_id', userId)
>>>>>>> origin/main
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
<<<<<<< HEAD
    return NextResponse.json({ success: true, reviews: data || [] });
  } catch (error) {
    return handleRouteError(error, 'code-review-history');
=======

    return NextResponse.json({ success: true, reviews: data || [] });
  } catch (error: any) {
    console.error('Fetch code reviews error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
>>>>>>> origin/main
  }
}

export async function DELETE(request: Request) {
<<<<<<< HEAD
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
=======
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('code_reviews').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete code review error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
>>>>>>> origin/main
  }
}
