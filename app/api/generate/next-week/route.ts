import { NextRequest, NextResponse } from 'next/server';
import { addWeeks, startOfWeek } from 'date-fns';

// Mark route as dynamic to prevent static analysis during build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Generate next week's calendar based on current week
 */
export async function POST(request: NextRequest) {
  // Lazy import to avoid module-level execution during build
  const { generateCalendar } = await import('@/lib/planning');
  const { evaluateCalendarQuality } = await import('@/lib/planning/quality');
  const { createServerClient } = await import('@/lib/supabase/client');
  try {
    const body = await request.json();
    const { current_calendar_id, company_id } = body;

    if (!current_calendar_id && !company_id) {
      return NextResponse.json(
        { error: 'Either current_calendar_id or company_id is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Get current calendar to determine next week
    let currentCalendar;
    let companyId: string;
    let postsPerWeek: number;

    if (current_calendar_id) {
      const { data: calendar } = await supabase
        .from('content_calendars')
        .select('*, company_id, posts_per_week, week_start_date')
        .eq('id', current_calendar_id)
        .single();

      if (!calendar) {
        return NextResponse.json(
          { error: 'Current calendar not found' },
          { status: 404 }
        );
      }

      // Type assertion for calendar
      type CalendarType = {
        company_id: string;
        posts_per_week: number;
        week_start_date: string;
        [key: string]: any;
      };
      const calendarData = calendar as CalendarType;
      currentCalendar = calendarData;
      companyId = calendarData.company_id;
      postsPerWeek = calendarData.posts_per_week;
    } else {
      // Use company_id directly
      companyId = company_id;
      
      // Get most recent calendar for this company to get posts_per_week
      const { data: recentCalendar } = await supabase
        .from('content_calendars')
        .select('posts_per_week, week_start_date')
        .eq('company_id', companyId)
        .order('week_start_date', { ascending: false })
        .limit(1)
        .single();

      // Type assertion for recentCalendar
      if (recentCalendar) {
        type RecentCalendarType = {
          posts_per_week: number;
          week_start_date: string;
          [key: string]: any;
        };
        const recentCalendarData = recentCalendar as RecentCalendarType;
        postsPerWeek = recentCalendarData.posts_per_week;
      } else {
        postsPerWeek = 5;
      }
    }

    // Calculate next week start date
    // Type assertion for currentCalendar
    type CurrentCalendarType = {
      week_start_date?: string;
      [key: string]: any;
    };
    const currentCalendarData = currentCalendar as CurrentCalendarType | null;
    const currentWeekStart = currentCalendarData?.week_start_date 
      ? new Date(currentCalendarData.week_start_date)
      : new Date();
    
    const nextWeekStart = addWeeks(startOfWeek(currentWeekStart, { weekStartsOn: 0 }), 1);

    // Check if next week's calendar already exists
    const nextWeekStartStr = nextWeekStart.toISOString().split('T')[0];
    const { data: existingCalendar } = await supabase
      .from('content_calendars')
      .select('id')
      .eq('company_id', companyId)
      .eq('week_start_date', nextWeekStartStr)
      .single();

    if (existingCalendar) {
      // Type assertion for existingCalendar
      type ExistingCalendarType = { id: string };
      const existingCalendarData = existingCalendar as ExistingCalendarType;
      return NextResponse.json(
        { 
          error: 'Next week\'s calendar already exists',
          calendar_id: existingCalendarData.id,
        },
        { status: 409 }
      );
    }

    // Generate next week's calendar
    const calendar = await generateCalendar({
      company_id: companyId,
      week_start_date: nextWeekStart,
      posts_per_week: postsPerWeek,
    });

    // Get posts and replies for quality evaluation
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

    // Get subreddits and personas for quality evaluation
    const { data: subreddits } = await supabase
      .from('subreddits')
      .select('*')
      .eq('company_id', companyId);

    const { data: personas } = await supabase
      .from('personas')
      .select('*')
      .eq('company_id', companyId);

    // Get previous weeks' posts for comparison
    const { data: previousCalendars } = await supabase
      .from('content_calendars')
      .select('id')
      .eq('company_id', companyId)
      .lt('week_start_date', nextWeekStartStr)
      .order('week_start_date', { ascending: false })
      .limit(4);

    // Type assertion for previousCalendars
    type PreviousCalendarType = { id: string };
    const previousCalendarsData = (previousCalendars || []) as PreviousCalendarType[];
    const previousCalendarIds = previousCalendarsData.map(c => c.id);
    let previousWeeksPosts: any[] = [];
    if (previousCalendarIds.length > 0) {
      const { data: prevPosts } = await supabase
        .from('calendar_posts')
        .select('*')
        .in('calendar_id', previousCalendarIds);
      previousWeeksPosts = prevPosts || [];
    }

    // Evaluate quality
    const quality = evaluateCalendarQuality({
      calendar,
      posts: posts || [],
      replies,
      subreddits: subreddits || [],
      personas: personas || [],
      previousWeeksPosts,
    });

    // Update calendar with quality scores
    // Cast supabase client to bypass strict typing for custom columns
    await (supabase as any)
      .from('content_calendars')
      .update({
        quality_score: quality,
        quality_feedback: quality.issues,
      })
      .eq('id', calendar.id);

    return NextResponse.json({
      calendar,
      quality,
      message: `Successfully generated calendar for week of ${nextWeekStartStr}`,
    });
  } catch (error: any) {
    console.error('Next week generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate next week\'s calendar' },
      { status: 500 }
    );
  }
}

