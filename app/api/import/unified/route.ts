import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { parseUnifiedExcel, getDayOfWeek, getWeekStart, inferPostType } from '@/lib/utils/unified-import';

/**
 * Unified import endpoint that imports both company info and calendar in one go
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'File must be an Excel file (.xlsx or .xls)' },
        { status: 400 }
      );
    }

    let parsedData;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      parsedData = parseUnifiedExcel(buffer);
      
      // Debug logging
      console.log('Parsed data:', {
        companyName: parsedData.company.name,
        personasCount: parsedData.personas.length,
        queriesCount: parsedData.seoQueries.length,
        postsCount: parsedData.posts.length,
        commentsCount: parsedData.comments.length,
      });
    } catch (parseError: any) {
      console.error('Excel parsing error:', parseError);
      console.error('Stack:', parseError.stack);
      return NextResponse.json(
        { error: `Failed to parse Excel file: ${parseError.message}` },
        { status: 400 }
      );
    }

    if (!parsedData.company.name) {
      console.error('Company name not found. Parsed company:', parsedData.company);
      return NextResponse.json(
        { 
          error: 'Company name not found in Excel file',
          details: 'Please ensure your Excel file has a "Company Info" sheet with "Name" in column A and the company name in column B'
        },
        { status: 400 }
      );
    }

    // Check Supabase configuration
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing Supabase config:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!serviceRoleKey,
      });
      return NextResponse.json(
        { 
          error: 'Server configuration error',
          details: 'Missing Supabase environment variables. Please check your .env.local file.'
        },
        { status: 500 }
      );
    }

    let supabase;
    try {
      supabase = createServerClient();
    } catch (clientError: any) {
      console.error('Failed to create Supabase client:', clientError);
      return NextResponse.json(
        { 
          error: 'Failed to connect to database',
          details: clientError.message
        },
        { status: 500 }
      );
    }

    // Step 1: Create Company
    let company, companyError;
    try {
      // Cast supabase client to bypass strict typing for inserts
      const result = await (supabase as any)
        .from('companies')
        .insert([{
          name: parsedData.company.name,
          description: parsedData.company.description || null,
          website_url: parsedData.company.website || null,
          target_users: [], // Can be inferred later
          pain_points: [], // Can be inferred later
          tone_positioning: null,
        }] as any)
        .select()
        .single();
      
      company = result.data as any;
      companyError = result.error;
    } catch (insertError: any) {
      console.error('Database insert error:', insertError);
      console.error('Error details:', {
        message: insertError.message,
        stack: insertError.stack,
        cause: insertError.cause,
      });
      return NextResponse.json(
        { 
          error: 'Failed to create company',
          details: insertError.message || 'Database connection failed. Please check your Supabase configuration.'
        },
        { status: 500 }
      );
    }

    if (companyError || !company) {
      console.error('Company creation error:', companyError);
      return NextResponse.json(
        { 
          error: `Failed to create company: ${companyError?.message || 'Unknown error'}`,
          details: companyError?.details || 'Please check your database connection and table structure.'
        },
        { status: 500 }
      );
    }

    const companyId = company.id;
    const results: any = {
      company,
      personas: [],
      subreddits: [],
      seoQueries: [],
      calendar: null,
      posts: 0,
      replies: 0,
    };

    // Step 2: Create Subreddits
    if (parsedData.company.subreddits && parsedData.company.subreddits.length > 0) {
      const subredditsToInsert = parsedData.company.subreddits.map(name => ({
        company_id: companyId,
        name: name.startsWith('r/') ? name : `r/${name}`,
        rules: null,
        min_cooldown_days: 7,
        max_posts_per_week: parsedData.company.posts_per_week || 3,
        size_category: 'medium' as const,
      }));

      const { data: subreddits, error: subredditsError } = await supabase
        .from('subreddits')
        .insert(subredditsToInsert as any) // Cast as any to resolve insert type issue
        .select();

      if (!subredditsError && subreddits) {
        results.subreddits = subreddits;
      }
    }

    // Step 3: Create Personas
    if (parsedData.personas.length > 0) {
      const personasToInsert = parsedData.personas.map(p => {
        // Infer tone from info
        const infoLower = p.info.toLowerCase();
        let tone = 'helpful';
        if (infoLower.includes('head') || infoLower.includes('senior') || infoLower.includes('experienced')) {
          tone = 'experienced';
        } else if (infoLower.includes('student') || infoLower.includes('learning')) {
          tone = 'curious';
        }

        // Infer expertise from info
        const expertise: string[] = [];
        if (infoLower.includes('operations') || infoLower.includes('ops')) expertise.push('operations');
        if (infoLower.includes('consultant') || infoLower.includes('consulting')) expertise.push('consulting');
        if (infoLower.includes('sales')) expertise.push('sales');
        if (infoLower.includes('product') || infoLower.includes('pm')) expertise.push('product');
        if (infoLower.includes('student') || infoLower.includes('economics')) expertise.push('student');

        return {
          company_id: companyId,
          name: p.username.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
          tone: tone,
          expertise: expertise.length > 0 ? expertise : ['general'],
          reddit_account: p.username,
        };
      });

      const { data: personas, error: personasError } = await supabase
        .from('personas')
        .insert(personasToInsert as any) // Cast as any to resolve type error with insert
        .select();

      if (!personasError && personas) {
        results.personas = personas;
      }
    }

    // Step 4: Create SEO Queries
    if (parsedData.seoQueries.length > 0) {
      const queriesToInsert = parsedData.seoQueries.map((q, index) => ({
        company_id: companyId,
        query: q.keyword,
        priority: parsedData.seoQueries.length - index, // Higher priority for earlier queries
      }));

      const { data: queries, error: queriesError } = await supabase
        .from('seo_queries')
        .insert(queriesToInsert as any)
        .select();

      if (!queriesError && queries) {
        results.seoQueries = queries;
      }
    }

    // Step 5: Create Calendar with Posts and Comments (if available)
    if (parsedData.posts.length > 0) {
      // Get personas and subreddits for mapping
      const { data: allPersonas } = await supabase
        .from('personas')
        .select('*')
        .eq('company_id', companyId);

      const { data: allSubreddits } = await supabase
        .from('subreddits')
        .select('*')
        .eq('company_id', companyId);

      const usernameToPersona = new Map<string, string>();
      (allPersonas as Array<{ reddit_account?: string; id: string }> | undefined)?.forEach(p => {
        if (p.reddit_account) {
          usernameToPersona.set(p.reddit_account.toLowerCase(), p.id);
        }
      });

      const subredditNameToId = new Map<string, string>();
      if (allSubreddits && Array.isArray(allSubreddits)) {
        (allSubreddits as Array<{ name: string; id: string }>).forEach(s => {
          const name = s.name.toLowerCase().replace(/^r\//, '');
          subredditNameToId.set(name, s.id);
          subredditNameToId.set(s.name.toLowerCase(), s.id);
        });
      }

      // Find week start
      const postDates = parsedData.posts
        .map(p => p.timestamp instanceof Date ? p.timestamp : new Date(p.timestamp))
        .filter(d => !isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());

      if (postDates.length > 0) {
        const weekStart = getWeekStart(postDates[0]);
        const weekStartStr = weekStart.toISOString().split('T')[0];

        // Create calendar
        const { data: calendar, error: calendarError } = await supabase
          .from('content_calendars')
          .insert({
            company_id: companyId,
            week_start_date: weekStartStr,
            posts_per_week: parsedData.posts.length,
            status: 'draft',
          } as any)
          .select()
          .single();

        if (!calendarError && calendar) {
          results.calendar = calendar;
          const calendarId = (calendar as any).id;
          const postIdMap = new Map<string, string>();

          // Create posts
          for (const excelPost of parsedData.posts) {
            const postDate = excelPost.timestamp instanceof Date 
              ? excelPost.timestamp 
              : new Date(excelPost.timestamp);
            
            const dayOfWeek = getDayOfWeek(postDate);
            const subredditName = excelPost.subreddit.toLowerCase().replace('r/', '');
            const subredditId = subredditNameToId.get(subredditName) || subredditNameToId.get(excelPost.subreddit.toLowerCase());
            
            if (!subredditId) continue;

            const username = excelPost.author_username.toLowerCase();
            const personaId = usernameToPersona.get(username) || (allPersonas as any)?.[0]?.id;
            
            if (!personaId) continue;

            const postType = inferPostType(excelPost.title, excelPost.body);

            const { data: post, error: postError } = await supabase
              .from('calendar_posts')
              .insert([{
                calendar_id: calendarId,
                day_of_week: dayOfWeek,
                subreddit_id: subredditId,
                topic: excelPost.title,
                persona_id: personaId,
                post_type: postType,
                planned_title: excelPost.title,
                planned_body: excelPost.body,
                order_in_day: 0,
              }] as any)
              .select()
              .single();

            if (!postError && post) {
              postIdMap.set(excelPost.post_id, (post as any).id);
              results.posts++;
            }
          }

          // Create replies
          for (const excelComment of parsedData.comments) {
            const postId = postIdMap.get(excelComment.post_id);
            if (!postId) continue;

            const username = excelComment.username.toLowerCase();
            const personaId = usernameToPersona.get(username) || (allPersonas as any)?.[0]?.id;
            if (!personaId) continue;

            const commentText = excelComment.comment_text.toLowerCase();
            let intent: 'ask' | 'challenge' | 'add_value' | 'clarify' = 'add_value';
            if (commentText.includes('?')) intent = 'ask';
            else if (commentText.includes('but') || commentText.includes('however')) intent = 'challenge';

            const { data: reply } = await supabase
              .from('calendar_replies')
              .insert([{
                post_id: postId,
                persona_id: personaId,
                intent: intent,
                order_after_post: 2, // Default 2 hours
                planned_content: excelComment.comment_text,
              }] as any)
              .select()
              .single();

            if (reply) {
              results.replies++;
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Imported company "${parsedData.company.name}" with ${results.personas.length} personas, ${results.subreddits.length} subreddits, ${results.seoQueries.length} SEO queries, and ${results.posts} posts with ${results.replies} replies`,
      data: results,
    });
  } catch (error: any) {
    console.error('Unified import error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to import Excel file',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

