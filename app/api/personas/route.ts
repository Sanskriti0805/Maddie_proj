import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get('company_id');
    const supabase = createServerClient();

    let query = supabase.from('personas').select('*');
    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ personas: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { company_id, name, tone, expertise, reddit_account } = body;

    if (!company_id || !name || !tone) {
      return NextResponse.json(
        { error: 'company_id, name, and tone are required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    // Cast supabase client to bypass strict typing for inserts
    const { data, error } = await (supabase as any)
      .from('personas')
      .insert({
        company_id,
        name,
        tone,
        expertise: expertise || [],
        reddit_account: reddit_account || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ persona: data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

