import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import type { Company } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ companies: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, target_users, pain_points, tone_positioning, website_url } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const supabase = createServerClient();
    // Cast supabase client to bypass strict typing for inserts
    const { data, error } = await (supabase as any)
      .from('companies')
      .insert({
        name,
        description: description || null,
        target_users: target_users || [],
        pain_points: pain_points || [],
        tone_positioning: tone_positioning || null,
        website_url: website_url || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ company: data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

