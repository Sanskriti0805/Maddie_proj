import { NextRequest, NextResponse } from 'next/server';
import { generateCalendar } from '@/lib/planning';
import { evaluateCalendarQuality } from '@/lib/planning/quality';
import { createServerClient } from '@/lib/supabase/client';

export async function POST(request: NextRequest) {
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

    const postIds = posts?.map(p => p.id) || [];
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

