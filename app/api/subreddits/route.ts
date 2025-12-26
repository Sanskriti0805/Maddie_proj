import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get('company_id');
    const supabase = createServerClient();

    let query = supabase.from('subreddits').select('*');
    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ subreddits: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      company_id,
      name,
      rules,
      min_cooldown_days,
      max_posts_per_week,
      size_category,
    } = body;

    if (!company_id || !name) {
      return NextResponse.json(
        { error: 'company_id and name are required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    // Cast supabase client to bypass strict typing for inserts
    const { data, error } = await (supabase as any)
      .from('subreddits')
      .insert({
        company_id,
        name,
        rules: rules || null,
        min_cooldown_days: min_cooldown_days || 7,
        max_posts_per_week: max_posts_per_week || 2,
        size_category: size_category || 'medium',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ subreddit: data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

