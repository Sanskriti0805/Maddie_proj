import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { parseCalendarExcel, getDayOfWeek, getWeekStart, inferPostType } from '@/lib/utils/calendar-import';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const companyId = formData.get('company_id') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!companyId) {
      return NextResponse.json(
        { error: 'company_id is required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'File must be an Excel file (.xlsx or .xls)' },
        { status: 400 }
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse Excel file
    const parsedData = parseCalendarExcel(buffer);

    if (parsedData.posts.length === 0) {
      return NextResponse.json(
        { error: 'No posts found in Excel file' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Get all personas and subreddits for this company
    const { data: personas } = await supabase
      .from('personas')
      .select('*')
      .eq('company_id', companyId);

    const { data: subreddits } = await supabase
      .from('subreddits')
      .select('*')
      .eq('company_id', companyId);

    // Type assertions
    type PersonaType = {
      id: string;
      reddit_account?: string;
      [key: string]: any;
    };
    type SubredditType = {
      id: string;
      name: string;
      [key: string]: any;
    };
    const personasData = (personas || []) as PersonaType[];
    const subredditsData = (subreddits || []) as SubredditType[];

    if (personasData.length === 0) {
      return NextResponse.json(
        { error: 'No personas found for this company. Please add personas first.' },
        { status: 400 }
      );
    }

    // Create username to persona mapping
    const usernameToPersona = new Map<string, string>();
    personasData.forEach(p => {
      if (p.reddit_account) {
        usernameToPersona.set(p.reddit_account.toLowerCase(), p.id);
      }
    });

    // Create subreddit name to ID mapping
    const subredditNameToId = new Map<string, string>();
    subredditsData.forEach(s => {
      const name = s.name.toLowerCase().replace('r/', '');
      subredditNameToId.set(name, s.id);
      subredditNameToId.set(s.name.toLowerCase(), s.id);
    });

    // Find the earliest post date to determine week start
    const postDates = parsedData.posts
      .map(p => p.timestamp instanceof Date ? p.timestamp : new Date(p.timestamp))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    if (postDates.length === 0) {
      return NextResponse.json(
        { error: 'No valid timestamps found in posts' },
        { status: 400 }
      );
    }

    const weekStart = getWeekStart(postDates[0]);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // Check if calendar already exists for this week
    const { data: existingCalendar } = await supabase
      .from('content_calendars')
      .select('id')
      .eq('company_id', companyId)
      .eq('week_start_date', weekStartStr)
      .single();

    let calendarId: string;
    if (existingCalendar) {
      // Type assertion for existingCalendar
      type ExistingCalendarType = { id: string; [key: string]: any };
      const existingCalendarData = existingCalendar as ExistingCalendarType;
      calendarId = existingCalendarData.id;
    } else {
      // Create calendar
      const { data: calendar, error: calendarError } = await (supabase as any)
        .from('content_calendars')
        .insert({
          company_id: companyId,
          week_start_date: weekStartStr,
          posts_per_week: parsedData.posts.length,
          status: 'draft',
        })
        .select()
        .single();

      if (calendarError || !calendar) {
        return NextResponse.json(
          { error: `Failed to create calendar: ${calendarError?.message}` },
          { status: 500 }
        );
      }
      // Type assertion for calendar
      type CalendarType = { id: string; [key: string]: any };
      const calendarData = calendar as CalendarType;
      calendarId = calendarData.id;
    }

    // Create posts
    const postIdMap = new Map<string, string>(); // Excel post_id -> database post id
    const createdPosts: any[] = [];

    for (const excelPost of parsedData.posts) {
      const postDate = excelPost.timestamp instanceof Date 
        ? excelPost.timestamp 
        : new Date(excelPost.timestamp);
      
      const dayOfWeek = getDayOfWeek(postDate);
      
      // Find subreddit
      const subredditName = excelPost.subreddit.toLowerCase().replace('r/', '');
      const subredditId = subredditNameToId.get(subredditName) || subredditNameToId.get(excelPost.subreddit.toLowerCase());
      
      if (!subredditId) {
        console.warn(`Subreddit not found: ${excelPost.subreddit}. Skipping post ${excelPost.post_id}`);
        continue;
      }

      // Find persona by username
      const username = excelPost.author_username.toLowerCase();
      let personaId = usernameToPersona.get(username);
      
      // If persona not found, use first persona as fallback
      if (!personaId && personasData.length > 0) {
        personaId = personasData[0].id;
        console.warn(`Persona not found for username "${excelPost.author_username}". Using first persona.`);
      }

      if (!personaId) {
        console.warn(`No personas available. Skipping post ${excelPost.post_id}`);
        continue;
      }

      // Infer post type
      const postType = inferPostType(excelPost.title, excelPost.body);

      // Create post
      // Cast supabase client to bypass strict typing for inserts
      const { data: post, error: postError } = await (supabase as any)
        .from('calendar_posts')
        .insert({
          calendar_id: calendarId,
          day_of_week: dayOfWeek,
          subreddit_id: subredditId,
          topic: excelPost.title,
          persona_id: personaId,
          post_type: postType,
          planned_title: excelPost.title,
          planned_body: excelPost.body,
          order_in_day: 0,
        })
        .select()
        .single();

      if (postError || !post) {
        console.error(`Failed to create post ${excelPost.post_id}:`, postError);
        continue;
      }

      postIdMap.set(excelPost.post_id, post.id);
      createdPosts.push(post);
    }

    // Create comments (replies)
    const commentIdMap = new Map<string, string>(); // Excel comment_id -> database reply id
    const createdReplies: any[] = [];

    for (const excelComment of parsedData.comments) {
      const postId = postIdMap.get(excelComment.post_id);
      if (!postId) {
        console.warn(`Post not found for comment ${excelComment.comment_id}. Skipping.`);
        continue;
      }

      // Find persona by username
      const username = excelComment.username.toLowerCase();
      let personaId = usernameToPersona.get(username);
      
      if (!personaId && personas.length > 0) {
        personaId = personas[0].id;
        console.warn(`Persona not found for username "${excelComment.username}". Using first persona.`);
      }

      if (!personaId) {
        continue;
      }

      // Calculate hours after post
      const post = createdPosts.find(p => p.id === postId);
      let hoursAfterPost = 2; // Default
      
      if (post) {
        const postDate = new Date(post.created_at);
        const commentDate = excelComment.timestamp instanceof Date 
          ? excelComment.timestamp 
          : new Date(excelComment.timestamp);
        const diffMs = commentDate.getTime() - postDate.getTime();
        hoursAfterPost = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
      }

      // Infer intent from comment text
      const commentText = excelComment.comment_text.toLowerCase();
      let intent: 'ask' | 'challenge' | 'add_value' | 'clarify' = 'add_value';
      if (commentText.includes('?')) {
        intent = 'ask';
      } else if (commentText.includes('but') || commentText.includes('however') || commentText.includes('disagree')) {
        intent = 'challenge';
      } else if (commentText.includes('clarify') || commentText.includes('what do you mean')) {
        intent = 'clarify';
      }

      // Create reply
      const { data: reply, error: replyError } = await supabase
        .from('calendar_replies')
        .insert({
          post_id: postId,
          persona_id: personaId,
          intent: intent,
          order_after_post: hoursAfterPost,
          planned_content: excelComment.comment_text,
        })
        .select()
        .single();

      if (!replyError && reply) {
        commentIdMap.set(excelComment.comment_id, reply.id);
        createdReplies.push(reply);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Imported calendar with ${createdPosts.length} posts and ${createdReplies.length} replies`,
      data: {
        calendar_id: calendarId,
        posts: createdPosts.length,
        replies: createdReplies.length,
      },
    });
  } catch (error: any) {
    console.error('Calendar import error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import calendar' },
      { status: 500 }
    );
  }
}

