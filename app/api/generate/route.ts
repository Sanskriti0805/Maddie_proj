import { NextRequest, NextResponse } from 'next/server';

// Mark route as dynamic to prevent static analysis during build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // Lazy import to avoid module-level execution during build
  const { generateCalendar } = await import('@/lib/planning');
  const { evaluateCalendarQuality } = await import('@/lib/planning/quality');
  const { createServerClient } = await import('@/lib/supabase/client');
  try {
    const body = await request.json();
    const { company_id, week_start_date, posts_per_week } = body;

    if (!company_id || !week_start_date || !posts_per_week) {
      return NextResponse.json(
        { error: 'company_id, week_start_date, and posts_per_week are required' },
        { status: 400 }
      );
    }

    // Generate calendar
    const calendar = await generateCalendar({
      company_id,
      week_start_date: new Date(week_start_date),
      posts_per_week: parseInt(posts_per_week),
    });

    // Get posts and replies for quality evaluation
    const supabase = createServerClient();
    const { data: posts } = await supabase
      .from('calendar_posts')
      .select('*')
      .eq('calendar_id', calendar.id);

    // Type assertion for posts
    type PostType = { id: string; [key: string]: any };
    const postsData = (posts || []) as PostType[];
    const postIds = postsData.map(p => p.id);
    let replies: any[] = [];
    if (postIds.length > 0) {
      const { data: repliesData } = await supabase
        .from('calendar_replies')
        .select('*')
        .in('post_id', postIds);
      replies = repliesData || [];
    }

    // Evaluate quality
    const quality = evaluateCalendarQuality({
      calendar,
      posts: posts || [],
      replies,
    });

    return NextResponse.json({
      calendar,
      quality,
    });
  } catch (error: any) {
    console.error('Calendar generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate calendar' },
      { status: 500 }
    );
  }
}

