import { NextResponse } from 'next/server';
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
  }
}
