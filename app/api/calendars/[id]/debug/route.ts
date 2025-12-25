import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

/**
 * Debug endpoint to check what posts exist for a calendar
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();

    // Get calendar
    const { data: calendar } = await supabase
      .from('content_calendars')
      .select('*')
      .eq('id', params.id)
      .single();

    if (!calendar) {
      return NextResponse.json({ error: 'Calendar not found' }, { status: 404 });
    }

    // Get ALL posts for this calendar
    const { data: posts, error: postsError } = await supabase
      .from('calendar_posts')
      .select('*')
      .eq('calendar_id', params.id);

    // Get ALL posts in database (to see if they're being created elsewhere)
    const { data: allPosts } = await supabase
      .from('calendar_posts')
      .select('id, calendar_id, topic, day_of_week, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    // Group by calendar_id
    const postsByCalendar: Record<string, number> = {};
    allPosts?.forEach(p => {
      postsByCalendar[p.calendar_id] = (postsByCalendar[p.calendar_id] || 0) + 1;
    });

    // Get all calendars for this company
    const { data: companyCalendars } = await supabase
      .from('content_calendars')
      .select('id, week_start_date, posts_per_week')
      .eq('company_id', calendar.company_id)
      .order('week_start_date', { ascending: false })
      .limit(10);

    return NextResponse.json({
      calendar_id: params.id,
      calendar: {
        id: calendar.id,
        week_start_date: calendar.week_start_date,
        company_id: calendar.company_id,
      },
      posts_for_this_calendar: posts?.length || 0,
      posts: posts?.map(p => ({
        id: p.id,
        calendar_id: p.calendar_id,
        day_of_week: p.day_of_week,
        topic: p.topic?.substring(0, 50),
        created_at: p.created_at,
      })) || [],
      all_posts_in_db: allPosts?.length || 0,
      posts_by_calendar_id: postsByCalendar,
      recent_calendars: companyCalendars?.map(c => ({
        id: c.id,
        week_start_date: c.week_start_date,
        posts_per_week: c.posts_per_week,
      })) || [],
      error: postsError?.message,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

