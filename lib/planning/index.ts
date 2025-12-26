import { createServerClient } from '@/lib/supabase/client';
import type {
  Company,
  Persona,
  Subreddit,
  SEOQuery,
  ContentCalendar,
  CalendarPost,
  CalendarReply,
  TopicHistory,
  SubredditActivity,
  PlanningParams,
  GeneratedTopic,
  SubredditScore,
} from '@/types';
import { generateTopics } from './topics';
import { selectSubreddit, updateSubredditActivity } from './subreddits';
import { assignPersona } from './personas';
import { planReplies, validateReplyPlans, generateReplyContent, selectToneAndEmotion, type EnhancedReplyPlan } from './conversations';
import { assignWeeklyStrategy, getPostTypeForStrategy, getStrategyRationale } from './strategy';
import { checkSpamAndSafety } from './anti-spam';
import { addDays, startOfWeek, format } from 'date-fns';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Main planning orchestrator - generates a complete weekly content calendar
 */
export async function generateCalendar(params: PlanningParams): Promise<ContentCalendar> {
  const { company_id, week_start_date, posts_per_week } = params;
  const supabase = createServerClient();

  // 1. Load all required data
  const { data: companyData } = await supabase
    .from('companies')
    .select('*')
    .eq('id', company_id)
    .single();
  
  // Type assertion for company
  type CompanyType = {
    id: string;
    name: string;
    target_users: string[];
    pain_points: string[];
    tone_positioning?: string;
    description?: string;
    [key: string]: any;
  };
  if (!companyData) {
    throw new Error('Company not found');
  }
  
  const company = companyData as CompanyType;

  const { data: personasData } = await supabase
    .from('personas')
    .select('*')
    .eq('company_id', company_id);

  if (!personasData || personasData.length === 0) {
    throw new Error('No personas found for company');
  }
  
  // Type assertion for personas
  const personas = personasData as Persona[];

  const { data: subredditsData } = await supabase
    .from('subreddits')
    .select('*')
    .eq('company_id', company_id);

  if (!subredditsData || subredditsData.length === 0) {
    throw new Error('No subreddits found for company');
  }
  
  // Type assertion for subreddits
  const subreddits = subredditsData as Subreddit[];

  const { data: seoQueries } = await supabase
    .from('seo_queries')
    .select('*')
    .eq('company_id', company_id)
    .order('priority', { ascending: false });

  // Load topic history
  const { data: topicHistory } = await supabase
    .from('topic_history')
    .select('*')
    .eq('company_id', company_id);

  // Load subreddit activities for the week
  const weekStart = startOfWeek(new Date(week_start_date), { weekStartsOn: 0 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');

  const { data: activities } = await supabase
    .from('subreddit_activity')
    .select('*')
    .eq('company_id', company_id)
    .eq('week_start_date', weekStartStr);

  // Load recent posts (last 7 days) for persona rotation
  // Get all calendars for this company, then get their posts
  const sevenDaysAgo = addDays(weekStart, -7);
  const { data: recentCalendars } = await supabase
    .from('content_calendars')
    .select('id')
    .eq('company_id', company_id)
    .gte('created_at', sevenDaysAgo.toISOString());

  // Type assertion for recentCalendars
  type RecentCalendarType = { id: string; [key: string]: any };
  const recentCalendarsData = (recentCalendars || []) as RecentCalendarType[];
  const recentCalendarIds = recentCalendarsData.map(c => c.id);
  let recentPosts: any[] = [];
  if (recentCalendarIds.length > 0) {
    const { data: postsData } = await supabase
      .from('calendar_posts')
      .select('*')
      .in('calendar_id', recentCalendarIds);
    recentPosts = postsData || [];
  }

  // 2. Generate topics
  const generatedTopics = await generateTopics({
    company: company as Company,
    seoQueries: (seoQueries || []) as SEOQuery[],
    topicHistory: (topicHistory || []) as TopicHistory[],
    count: posts_per_week + 5, // Generate extra for filtering
  });

  console.log(`Generated ${generatedTopics.length} topics for ${posts_per_week} posts`);
  
  if (generatedTopics.length === 0) {
    throw new Error('No topics were generated. Check OpenAI API key and company configuration.');
  }

  // 3. Create calendar (or use existing)
  let calendar: ContentCalendar;
  if (params.existing_calendar_id) {
    const { data: existingCalendar, error: calendarError } = await supabase
      .from('content_calendars')
      .select('*')
      .eq('id', params.existing_calendar_id)
      .single();

    if (calendarError || !existingCalendar) {
      throw new Error(`Failed to find existing calendar: ${calendarError?.message}`);
    }
    calendar = existingCalendar as ContentCalendar;
  } else {
    // Cast supabase client to bypass strict typing for inserts
    const { data: newCalendar, error: calendarError } = await (supabase as any)
      .from('content_calendars')
      .insert({
        company_id,
        week_start_date: weekStartStr,
        posts_per_week,
        status: 'draft',
      })
      .select()
      .single();

    if (calendarError || !newCalendar) {
      throw new Error(`Failed to create calendar: ${calendarError?.message}`);
    }
    calendar = newCalendar as ContentCalendar;
  }

  // 4. Plan posts for each day of the week with strategy
  const posts: CalendarPost[] = [];
  const postPersonaMap = new Map<string, string>();
  const usedTopics = new Set<string>();
  const dayPosts = distributePostsAcrossWeek(posts_per_week);
  
  // Assign posting strategies to days
  const strategyMap = assignWeeklyStrategy(posts_per_week, dayPosts);

  let topicIndex = 0;
  // Type assertion for activities
  type ActivityType = {
    subreddit_id: string;
    [key: string]: any;
  };
  const activitiesData = (activities || []) as ActivityType[];
  const activitiesMap = new Map<string, SubredditActivity>();
  activitiesData.forEach(a => {
    activitiesMap.set(a.subreddit_id, a as SubredditActivity);
  });
  
  // Load previous weeks' posts for spam checking
  const { data: previousCalendars } = await supabase
    .from('content_calendars')
    .select('id')
    .eq('company_id', company_id)
    .lt('week_start_date', weekStartStr)
    .order('week_start_date', { ascending: false })
    .limit(4); // Last 4 weeks
    
  // Type assertion for previousCalendars
  type PreviousCalendarType = { id: string; [key: string]: any };
  const previousCalendarsData = (previousCalendars || []) as PreviousCalendarType[];
  const previousCalendarIds = previousCalendarsData.map(c => c.id);
  let previousWeeksPosts: CalendarPost[] = [];
  if (previousCalendarIds.length > 0) {
    const { data: prevPosts } = await supabase
      .from('calendar_posts')
      .select('*')
      .in('calendar_id', previousCalendarIds);
    previousWeeksPosts = (prevPosts || []) as CalendarPost[];
  }

  console.log(`Planning ${posts_per_week} posts across week. Distribution:`, dayPosts);
  console.log(`Distribution breakdown:`, {
    Sunday: dayPosts[0],
    Monday: dayPosts[1],
    Tuesday: dayPosts[2],
    Wednesday: dayPosts[3],
    Thursday: dayPosts[4],
    Friday: dayPosts[5],
    Saturday: dayPosts[6],
  });
  let skippedCount = 0;
  let skipReasons: string[] = [];
  const postsByDayCreated = [0, 0, 0, 0, 0, 0, 0]; // Track actual posts created per day

  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    const postsForDay = dayPosts[dayOfWeek];
    if (postsForDay === 0) {
      console.log(`Skipping day ${dayOfWeek} (${DAYS[dayOfWeek]}) - no posts scheduled`);
      continue;
    }
    console.log(`\n=== Processing day ${dayOfWeek} (${DAYS[dayOfWeek]}) - ${postsForDay} post(s) scheduled ===`);

    const targetDate = addDays(weekStart, dayOfWeek);

    // Get strategies for this day
    const dayStrategies = strategyMap.get(dayOfWeek) || ['value'];
    
    for (let i = 0; i < postsForDay; i++) {
      // Get strategy for this post
      const strategy = dayStrategies[i] || dayStrategies[0] || 'value';
      const { preferredTypes } = getPostTypeForStrategy(strategy);
      
      // Find next available topic that matches strategy
      let topic: GeneratedTopic | null = null;
      while (topicIndex < generatedTopics.length) {
        const candidate = generatedTopics[topicIndex];
        if (!usedTopics.has(candidate.topic) && preferredTypes.includes(candidate.post_type)) {
          topic = candidate;
          usedTopics.add(candidate.topic);
          topicIndex++;
          break;
        }
        topicIndex++;
      }
      
      // Fallback: find any unused topic
      if (!topic) {
        let fallbackIndex = 0;
        while (fallbackIndex < generatedTopics.length) {
          const candidate = generatedTopics[fallbackIndex];
          if (!usedTopics.has(candidate.topic)) {
            topic = candidate;
            usedTopics.add(candidate.topic);
            break;
          }
          fallbackIndex++;
        }
      }

      if (!topic) {
        console.warn('Ran out of topics, generating fallback');
        // Generate fallback topic matching strategy
        topic = {
          topic: `Discussion about ${company.target_users[0] || 'business'} challenges`,
          relevance_score: 0.5,
          post_type: preferredTypes[0] || 'question',
        };
      }

      // Select subreddit
      let subreddit: Subreddit | null = null;
      let selectedSubreddit: SubredditScore | null = null;
      
      const subredditScores = selectSubreddit({
        subreddits: subreddits as Subreddit[],
        activities: Array.from(activitiesMap.values()),
        topic,
        targetDate,
        companyId: company_id,
      });

      if (subredditScores.length > 0) {
        selectedSubreddit = subredditScores[0];
        subreddit = subreddits.find(s => s.id === selectedSubreddit!.subreddit_id) || null;
      }
      
      // Aggressive fallback: use first available subreddit if selection failed
      if (!subreddit && subreddits.length > 0) {
        skippedCount++;
        const reason = `No suitable subreddit found for topic "${topic.topic}", using fallback`;
        skipReasons.push(reason);
        console.warn(`${reason}. Available subreddits: ${subreddits.length}`);
        subreddit = subreddits[0];
        console.warn(`Using fallback subreddit: ${subreddit.name}`);
      }
      
      if (!subreddit) {
        console.error('No subreddits available at all');
        continue;
      }

      // Assign persona with aggressive fallback
      let persona: Persona | null = null;
      const personaAssignment = assignPersona({
        personas: personas,
        topic,
        recentPosts: (recentPosts || []) as CalendarPost[],
        targetDate,
        subredditId: subreddit.id,
      });

      if (personaAssignment) {
        persona = personas.find(p => p.id === personaAssignment.persona_id) || null;
      }
      
      // Aggressive fallback: use first available persona if assignment failed
      if (!persona && personas.length > 0) {
        skippedCount++;
        const reason = `No suitable persona found for topic "${topic.topic}", using fallback`;
        skipReasons.push(reason);
        console.warn(`${reason}. Available personas: ${personas.length}`);
        persona = personas[0];
        console.warn(`Using fallback persona: ${persona.name}`);
      }
      
      if (!persona) {
        console.error('No personas available at all');
        continue;
      }

      // Create post with strategy
      const postData: any = {
        calendar_id: calendar.id,
        day_of_week: dayOfWeek,
        subreddit_id: subreddit.id,
        topic: topic.topic,
        persona_id: persona.id,
        post_type: topic.post_type,
        order_in_day: i,
        posting_strategy: strategy, // This column may not exist - will be handled in error
      };

      console.log(`Creating post for day ${dayOfWeek}, calendar_id: ${calendar.id}, topic: ${topic.topic.substring(0, 50)}`);

      // Cast supabase client to bypass strict typing for inserts
      const { data: post, error: postError } = await (supabase as any)
        .from('calendar_posts')
        .insert(postData)
        .select()
        .single();

      if (postError || !post) {
        // If error is about posting_strategy column, try without it
        if (postError?.message?.includes('posting_strategy') || postError?.code === '42703') {
          console.warn('posting_strategy column not found, retrying without it');
          // Cast supabase client to bypass strict typing for inserts
          const { data: retryPost, error: retryError } = await (supabase as any)
            .from('calendar_posts')
            .insert({
              calendar_id: calendar.id,
              day_of_week: dayOfWeek,
              subreddit_id: subreddit.id,
              topic: topic.topic,
              persona_id: persona.id,
              post_type: topic.post_type,
              order_in_day: i,
            })
            .select()
            .single();
          
          if (retryError || !retryPost) {
            console.error('Failed to create post even without posting_strategy:', retryError);
            console.error('Post data attempted:', { 
              calendar_id: calendar.id, 
              topic: topic.topic.substring(0, 50),
              subreddit_id: subreddit.id,
              persona_id: persona.id 
            });
            continue;
          }
          
          posts.push(retryPost as CalendarPost);
          postPersonaMap.set(retryPost.id, persona.id);
        } else {
          console.error('Failed to create post:', postError);
          console.error('Post data attempted:', { 
            calendar_id: calendar.id, 
            topic: topic.topic.substring(0, 50),
            subreddit_id: subreddit.id,
            persona_id: persona.id 
          });
          continue;
        }
      } else {
        console.log(`✓ Successfully created post ${post.id} for day ${dayOfWeek} (${DAYS[dayOfWeek]})`);
        posts.push(post as CalendarPost);
        postPersonaMap.set(post.id, persona.id);
        postsByDayCreated[dayOfWeek]++;
      }

      // Update subreddit activity
      const updatedActivity = updateSubredditActivity(
        subreddit.id,
        company_id,
        targetDate,
        Array.from(activitiesMap.values())
      );
      activitiesMap.set(subreddit.id, updatedActivity);

      // Update topic history
      // Cast supabase client to bypass strict typing for upserts
      await (supabase as any)
        .from('topic_history')
        .upsert({
          company_id,
          topic: topic.topic,
          last_used_date: format(targetDate, 'yyyy-MM-dd'),
          usage_count: 1,
        }, {
          onConflict: 'company_id,topic',
        });
    }
  }

  console.log(`\n=== Post Creation Summary ===`);
  console.log(`Total posts created: ${posts.length} out of ${posts_per_week} planned`);
  console.log(`Skipped posts: ${skippedCount}`);
  console.log(`Posts by day created:`, {
    Sunday: postsByDayCreated[0],
    Monday: postsByDayCreated[1],
    Tuesday: postsByDayCreated[2],
    Wednesday: postsByDayCreated[3],
    Thursday: postsByDayCreated[4],
    Friday: postsByDayCreated[5],
    Saturday: postsByDayCreated[6],
  });
  console.log(`Posts by day planned:`, {
    Sunday: dayPosts[0],
    Monday: dayPosts[1],
    Tuesday: dayPosts[2],
    Wednesday: dayPosts[3],
    Thursday: dayPosts[4],
    Friday: dayPosts[5],
    Saturday: dayPosts[6],
  });
  
  // Verify posts were actually saved to database
  const { data: verifyPosts } = await supabase
    .from('calendar_posts')
    .select('id, day_of_week')
    .eq('calendar_id', calendar.id);
  console.log(`Verification: Found ${verifyPosts?.length || 0} posts in database for calendar ${calendar.id}`);
  
  // Group by day for verification
  const verifyByDay = [0, 0, 0, 0, 0, 0, 0];
  // Type assertion for verifyPosts
  type PostType = {
    day_of_week: number;
    [key: string]: any;
  };
  const verifyPostsData = (verifyPosts || []) as PostType[];
  verifyPostsData.forEach(p => {
    if (p.day_of_week >= 0 && p.day_of_week <= 6) {
      verifyByDay[p.day_of_week]++;
    }
  });
  console.log(`Posts in database by day:`, {
    Sunday: verifyByDay[0],
    Monday: verifyByDay[1],
    Tuesday: verifyByDay[2],
    Wednesday: verifyByDay[3],
    Thursday: verifyByDay[4],
    Friday: verifyByDay[5],
    Saturday: verifyByDay[6],
  });
  
  if (posts.length === 0) {
    const errorMsg = skipReasons.length > 0 
      ? `Failed to create any posts. Reasons: ${skipReasons.slice(0, 3).join('; ')}`
      : 'Failed to create any posts. Check console logs for database errors.';
    console.error('Skip reasons:', skipReasons.slice(0, 5));
    throw new Error(errorMsg);
  }

  // 5. Plan replies with enhanced content generation
  const replyPlans = planReplies({
    posts,
    personas: personas as Persona[],
    postPersonaMap,
  });

  const validatedReplies = validateReplyPlans(replyPlans, posts, postPersonaMap);

  // 6. Create replies in database with generated content
  const replies: CalendarReply[] = [];
  for (const [postId, plan] of validatedReplies.entries()) {
    const post = posts.find(p => p.id === postId);
    if (!post) continue;
    
    const replyPersona = personas.find(p => p.id === plan.persona_id);
    if (!replyPersona) continue;
    
    // Generate realistic reply content
    const enhancedPlan = plan as EnhancedReplyPlan;
    const replyContent = await generateReplyContent(
      post,
      replyPersona,
      plan.intent,
      enhancedPlan.tone || 'helpful',
      enhancedPlan.emotion || 'supportive'
    );

    // Cast supabase client to bypass strict typing for inserts
    const { data: reply, error: replyError } = await (supabase as any)
      .from('calendar_replies')
      .insert({
        post_id: postId,
        persona_id: plan.persona_id,
        intent: plan.intent,
        order_after_post: plan.hours_after_post,
        planned_content: replyContent,
        tone: enhancedPlan.tone || 'helpful',
        emotion: enhancedPlan.emotion || 'supportive',
      })
      .select()
      .single();

    if (!replyError && reply) {
      replies.push(reply as CalendarReply);
    }
  }
  
  // 7. Run spam and safety checks
  const spamCheck = checkSpamAndSafety(
    posts,
    replies,
    subreddits,
    personas as Persona[],
    previousWeeksPosts
  );
  
  // Update calendar with spam warnings
  if (spamCheck.warnings.length > 0) {
    // Cast supabase client to bypass strict typing for updates
    await (supabase as any)
      .from('content_calendars')
      .update({
        spam_warnings: spamCheck.warnings,
      })
      .eq('id', calendar.id);
  }

  // 8. Update subreddit activities
  for (const activity of activitiesMap.values()) {
    // Cast supabase client to bypass strict typing for upserts
    await (supabase as any)
      .from('subreddit_activity')
      .upsert(activity, {
        onConflict: 'subreddit_id,company_id,week_start_date',
      });
  }

  return calendar as ContentCalendar;
}

/**
 * Distributes posts across the week (more posts on weekdays, but ensures balanced coverage)
 */
function distributePostsAcrossWeek(totalPosts: number): number[] {
  const distribution = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
  const weights = [0.7, 1.2, 1.2, 1.2, 1.2, 1.1, 0.9]; // Weekdays weighted higher, but weekends not too low

  // Strategy: For small numbers, ensure better spread including weekends
  if (totalPosts <= 5) {
    // For 5 posts: ensure Friday and Saturday get posts
    if (totalPosts === 5) {
      // Distribute: Mon, Tue, Wed, Fri, Sat (skip Thu to include weekends)
      distribution[1] = 1; // Monday
      distribution[2] = 1; // Tuesday  
      distribution[3] = 1; // Wednesday
      distribution[5] = 1; // Friday
      distribution[6] = 1; // Saturday
      // Thursday and Sunday get 0
    } else if (totalPosts === 4) {
      // For 4 posts: Mon-Thu get 1 each
      distribution[1] = 1;
      distribution[2] = 1;
      distribution[3] = 1;
      distribution[4] = 1;
    } else {
      // For 1-3 posts, use weighted distribution
      let remaining = totalPosts;
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      
      for (let i = 0; i < 7; i++) {
        const count = Math.floor((weights[i] / totalWeight) * remaining);
        distribution[i] = count;
        remaining -= count;
      }
      
      // Distribute remainder - prefer Friday/Saturday if they have 0
      while (remaining > 0) {
        if (distribution[5] === 0) {
          distribution[5] = 1;
        } else if (distribution[6] === 0) {
          distribution[6] = 1;
        } else {
          // Add to highest weighted day with least posts
          let bestIndex = 0;
          let bestScore = -1;
          for (let i = 0; i < 7; i++) {
            const score = weights[i] / (distribution[i] + 1);
            if (score > bestScore) {
              bestScore = score;
              bestIndex = i;
            }
          }
          distribution[bestIndex]++;
        }
        remaining--;
      }
    }
  } else {
    // For 6+ posts, use standard weighted distribution
    let remaining = totalPosts;
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    // First pass: distribute based on weights
    for (let i = 0; i < 7; i++) {
      const count = Math.floor((weights[i] / totalWeight) * remaining);
      distribution[i] = count;
      remaining -= count;
    }

    // Second pass: distribute remainder to days with lowest current count (more balanced)
    while (remaining > 0) {
      let minCount = Math.min(...distribution);
      let minIndices: number[] = [];
      for (let i = 0; i < 7; i++) {
        if (distribution[i] === minCount) {
          minIndices.push(i);
        }
      }
      // Among days with min count, prefer higher weighted days
      let bestIndex = minIndices[0];
      for (const idx of minIndices) {
        if (weights[idx] > weights[bestIndex]) {
          bestIndex = idx;
        }
      }
      distribution[bestIndex]++;
      remaining--;
    }
  }

  return distribution;
}

