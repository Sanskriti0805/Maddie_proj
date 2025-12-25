import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();

    // Get calendar
    const { data: calendar, error: calendarError } = await supabase
      .from('content_calendars')
      .select('*')
      .eq('id', params.id)
      .single();

    if (calendarError || !calendar) {
      return NextResponse.json(
        { error: 'Calendar not found' },
        { status: 404 }
      );
    }

    // Get posts - try without ordering first to see if that's the issue
    console.log(`Fetching posts for calendar_id: ${params.id}`);
    const { data: posts, error: postsError } = await supabase
      .from('calendar_posts')
      .select('*')
      .eq('calendar_id', params.id);

    if (postsError) {
      console.error('Error fetching posts:', postsError);
      return NextResponse.json({ error: postsError.message }, { status: 500 });
    }
    
    console.log(`Calendar ${params.id}: Found ${posts?.length || 0} posts (raw query)`);
    
    // Sort in memory if needed
    const sortedPosts = posts?.sort((a, b) => {
      if (a.day_of_week !== b.day_of_week) {
        return a.day_of_week - b.day_of_week;
      }
      return (a.order_in_day || 0) - (b.order_in_day || 0);
    });
    
    console.log(`After sorting: ${sortedPosts?.length || 0} posts`);

    // Use sorted posts
    const postsToUse = sortedPosts || posts || [];
    
    // Get replies
    const postIds = postsToUse.map(p => p.id);
    let replies: any[] = [];
    if (postIds.length > 0) {
      const { data: repliesData, error: repliesError } = await supabase
        .from('calendar_replies')
        .select('*')
        .in('post_id', postIds);

      if (!repliesError && repliesData) {
        replies = repliesData;
      }
    }

    // Get related data - handle empty arrays
    const subredditIds = postsToUse.map(p => p.subreddit_id).filter(Boolean);
    const personaIds = [
      ...postsToUse.map(p => p.persona_id).filter(Boolean),
      ...replies.map(r => r.persona_id).filter(Boolean),
    ];
    
    let subreddits: any[] = [];
    if (subredditIds.length > 0) {
      const { data: subredditsData } = await supabase
        .from('subreddits')
        .select('*')
        .in('id', subredditIds);
      subreddits = subredditsData || [];
    }

    let personas: any[] = [];
    if (personaIds.length > 0) {
      const { data: personasData } = await supabase
        .from('personas')
        .select('*')
        .in('id', personaIds);
      personas = personasData || [];
    }

    // Enrich posts with details
    const enrichedPosts = postsToUse.map(post => ({
      ...post,
      subreddit: subreddits?.find(s => s.id === post.subreddit_id),
      persona: personas?.find(p => p.id === post.persona_id),
      replies: replies.filter(r => r.post_id === post.id).map(reply => ({
        ...reply,
        persona: personas?.find(p => p.id === reply.persona_id),
      })),
    }));

    console.log(`Returning ${enrichedPosts.length} enriched posts`);

    return NextResponse.json({
      calendar,
      posts: enrichedPosts,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

