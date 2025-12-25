import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { generateCalendar } from '@/lib/planning';
import { evaluateCalendarQuality } from '@/lib/planning/quality';

/**
 * Generate posts for an existing calendar
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();

    // Get existing calendar
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

    // Type assertion for calendar
    type CalendarType = {
      id: string;
      company_id: string;
      week_start_date: string;
      posts_per_week: number;
      [key: string]: any;
    };
    const calendarData = calendar as CalendarType;

    // Check if posts already exist - if they do, delete them first to allow regeneration
    const { data: existingPosts } = await supabase
      .from('calendar_posts')
      .select('id')
      .eq('calendar_id', params.id);

    // Type assertion for existingPosts
    type PostIdType = { id: string };
    const existingPostsData = (existingPosts || []) as PostIdType[];

    if (existingPostsData.length > 0) {
      console.log(`Found ${existingPostsData.length} existing posts, deleting them...`);
      // Delete existing posts and replies to allow regeneration
      const existingPostIds = existingPostsData.map(p => p.id);
      
      // Delete replies first (foreign key constraint)
      const { error: deleteRepliesError } = await supabase
        .from('calendar_replies')
        .delete()
        .in('post_id', existingPostIds);
      
      if (deleteRepliesError) {
        console.error('Error deleting replies:', deleteRepliesError);
      }
      
      // Then delete posts
      const { error: deletePostsError } = await supabase
        .from('calendar_posts')
        .delete()
        .eq('calendar_id', params.id);
      
      if (deletePostsError) {
        console.error('Error deleting posts:', deletePostsError);
      } else {
        console.log(`Successfully deleted ${existingPostsData.length} existing posts`);
      }
      
      // Verify deletion
      const { data: verifyDeleted } = await supabase
        .from('calendar_posts')
        .select('id')
        .eq('calendar_id', params.id);
      console.log(`Verification: ${verifyDeleted?.length || 0} posts remaining after deletion`);
    }

    // Generate posts for existing calendar (pass existing_calendar_id to avoid creating duplicate)
    try {
      console.log(`Generating posts for calendar ${params.id}, company ${calendarData.company_id}`);
      await generateCalendar({
        company_id: calendarData.company_id,
        week_start_date: new Date(calendarData.week_start_date),
        posts_per_week: calendarData.posts_per_week,
        existing_calendar_id: params.id, // Use existing calendar
      });
      console.log('Calendar generation completed');
    } catch (error: any) {
      console.error('Generation error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to generate posts. Check console for details.' },
        { status: 500 }
      );
    }

    // Small delay to ensure database commits
    await new Promise(resolve => setTimeout(resolve, 200));

    // Get updated posts and replies for quality evaluation
    console.log(`Fetching posts for calendar ${params.id}`);
    
    // Try multiple times in case of timing issues
    let posts: any[] | null = null;
    let attempts = 0;
    while (attempts < 3 && (!posts || posts.length === 0)) {
      const { data: fetchedPosts, error: postsFetchError } = await supabase
        .from('calendar_posts')
        .select('*')
        .eq('calendar_id', params.id);
      
      if (postsFetchError) {
        console.error(`Attempt ${attempts + 1}: Error fetching posts:`, postsFetchError);
        if (attempts === 2) {
          return NextResponse.json(
            { error: `Failed to fetch posts: ${postsFetchError.message}` },
            { status: 500 }
          );
        }
      } else {
        posts = fetchedPosts;
        console.log(`Attempt ${attempts + 1}: Found ${posts?.length || 0} posts for calendar ${params.id}`);
        if (posts && posts.length > 0) break;
      }
      
      if (posts?.length === 0 && attempts < 2) {
        console.log(`No posts found, waiting 300ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      attempts++;
    }
    
    if (!posts) {
      posts = [];
    }

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
      .eq('company_id', calendarData.company_id);

    const { data: personas } = await supabase
      .from('personas')
      .select('*')
      .eq('company_id', calendarData.company_id);

    // Evaluate quality
    const quality = evaluateCalendarQuality({
      calendar: calendarData,
      posts: posts || [],
      replies,
      subreddits: subreddits || [],
      personas: personas || [],
    });

    // Update calendar with quality scores
    await supabase
      .from('content_calendars')
      .update({
        quality_score: quality,
        quality_feedback: quality.issues,
      } as any)
      .eq('id', params.id);

    const postCount = posts?.length || 0;
    const replyCount = replies.length;
    
    // Debug: Check all posts for this calendar
    const { data: allPostsDebug } = await supabase
      .from('calendar_posts')
      .select('id, calendar_id, topic, day_of_week')
      .eq('calendar_id', params.id);
    type PostDebugType = { id: string; calendar_id: string; topic?: string; day_of_week: number };
    const allPostsDebugData = (allPostsDebug || []) as PostDebugType[];
    console.log(`Debug: Posts with calendar_id ${params.id}:`, allPostsDebugData.length);
    if (allPostsDebugData.length > 0) {
      console.log('Debug: Post details:', allPostsDebugData.map(p => ({
        id: p.id,
        calendar_id: p.calendar_id,
        day: p.day_of_week,
        topic: p.topic?.substring(0, 30)
      })));
    }
    
    // Also check ALL posts in calendar_posts table (to see if they're being created elsewhere)
    const { data: allPostsEverywhere } = await supabase
      .from('calendar_posts')
      .select('id, calendar_id, topic')
      .limit(20);
    type PostEverywhereType = { id: string; calendar_id: string; topic?: string };
    const allPostsEverywhereData = (allPostsEverywhere || []) as PostEverywhereType[];
    console.log(`Debug: Total posts in database (first 20):`, allPostsEverywhereData.length);
    if (allPostsEverywhereData.length > 0) {
      const postsByCalendar = allPostsEverywhereData.reduce((acc: any, p: PostEverywhereType) => {
        acc[p.calendar_id] = (acc[p.calendar_id] || 0) + 1;
        return acc;
      }, {});
      console.log('Debug: Posts by calendar_id:', postsByCalendar);
    }

    if (postCount === 0) {
      // Provide helpful error message
      const { data: companyData } = await supabase
        .from('companies')
        .select('id')
        .eq('id', calendarData.company_id)
        .single();

      const { data: personasData } = await supabase
        .from('personas')
        .select('id')
        .eq('company_id', calendarData.company_id);

      const { data: subredditsData } = await supabase
        .from('subreddits')
        .select('id')
        .eq('company_id', calendarData.company_id);

      return NextResponse.json({
        success: false,
        error: 'No posts were generated',
        message: `Generated 0 posts. Check: ${personasData?.length || 0} personas, ${subredditsData?.length || 0} subreddits available.`,
        posts: 0,
        replies: 0,
        debug: {
          personas_count: personasData?.length || 0,
          subreddits_count: subredditsData?.length || 0,
        },
      }, { status: 400 });
    }

    // Final verification before returning
    const { data: finalCheck } = await supabase
      .from('calendar_posts')
      .select('id')
      .eq('calendar_id', params.id);
    type FinalCheckType = { id: string };
    const finalCheckData = (finalCheck || []) as FinalCheckType[];
    const finalCount = finalCheckData.length;
    
    console.log(`Final check: ${finalCount} posts exist for calendar ${params.id}`);
    
    if (finalCount !== postCount) {
      console.warn(`Mismatch! Expected ${postCount} posts but found ${finalCount} in database`);
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${postCount} posts and ${replyCount} replies`,
      posts: finalCount, // Return actual count from database
      replies: replyCount,
      quality,
      debug: {
        expected: postCount,
        actual: finalCount,
        calendar_id: params.id,
      },
    });
  } catch (error: any) {
    console.error('Post generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate posts' },
      { status: 500 }
    );
  }
}

