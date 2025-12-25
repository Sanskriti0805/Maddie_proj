import { NextRequest, NextResponse } from 'next/server';
import { generateCalendar } from '@/lib/planning';
import { evaluateCalendarQuality } from '@/lib/planning/quality';
import { createServerClient } from '@/lib/supabase/client';
import { addWeeks, startOfWeek } from 'date-fns';

/**
 * Generate next week's calendar based on current week
 */
export async function POST(request: NextRequest) {
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
        [key: string]: any;
      };
      const calendarData = calendar as CalendarType;
      currentCalendar = calendar;
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
    const currentWeekStart = currentCalendar?.week_start_date 
      ? new Date(currentCalendar.week_start_date)
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
      return NextResponse.json(
        { 
          error: 'Next week\'s calendar already exists',
          calendar_id: existingCalendar.id,
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

    const postIds = posts?.map(p => p.id) || [];
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

    const previousCalendarIds = previousCalendars?.map(c => c.id) || [];
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
    await supabase
      .from('content_calendars')
      .update({
        quality_score: quality,
        quality_feedback: quality.issues,
      } as any)
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

