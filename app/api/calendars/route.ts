import { NextRequest, NextResponse } from 'next/server';

// Mark route as dynamic to prevent static analysis during build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { createServerClient } = await import('@/lib/supabase/client');
  try {
    const companyId = request.nextUrl.searchParams.get('company_id');
    const supabase = createServerClient();

    let query = supabase
      .from('content_calendars')
      .select('*')
      .order('week_start_date', { ascending: false });

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ calendars: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

