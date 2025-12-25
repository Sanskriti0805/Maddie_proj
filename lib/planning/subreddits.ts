import type { Subreddit, SubredditActivity, GeneratedTopic, SubredditScore } from '@/types';
import { addDays, differenceInDays } from 'date-fns';

interface SubredditSelectionParams {
  subreddits: Subreddit[];
  activities: SubredditActivity[];
  topic: GeneratedTopic;
  targetDate: Date;
  companyId: string;
}

/**
 * Scores and selects appropriate subreddits for a topic
 */
export function selectSubreddit(
  params: SubredditSelectionParams
): SubredditScore[] {
  const { subreddits, activities, topic, targetDate, companyId } = params;

  const scores: SubredditScore[] = subreddits.map(subreddit => {
    const activity = activities.find(
      a => a.subreddit_id === subreddit.id && a.company_id === companyId
    );

    const reasons: string[] = [];
    let score = 0;

    // 1. Relevance Match (40% weight)
    const relevanceScore = calculateRelevanceScore(subreddit, topic);
    score += relevanceScore * 0.4;
    if (relevanceScore > 0.7) {
      reasons.push('High topic relevance');
    } else if (relevanceScore < 0.3) {
      reasons.push('Low topic relevance');
    }

    // 2. Cooldown Check (30% weight)
    const cooldownScore = checkCooldown(subreddit, activity, targetDate);
    score += cooldownScore * 0.3;
    if (cooldownScore === 0) {
      reasons.push('Cooldown period not met');
    } else if (cooldownScore > 0.8) {
      reasons.push('Cooldown period satisfied');
    }

    // 3. Frequency Limit (20% weight)
    const frequencyScore = checkFrequency(subreddit, activity, targetDate);
    score += frequencyScore * 0.2;
    if (frequencyScore === 0) {
      reasons.push('Weekly post limit reached');
    } else if (frequencyScore > 0.8) {
      reasons.push('Within posting limits');
    }

    // 4. Size Appropriateness (10% weight)
    const sizeScore = checkSizeAppropriateness(subreddit, topic);
    score += sizeScore * 0.1;
    if (sizeScore > 0.7) {
      reasons.push(`Appropriate for ${subreddit.size_category} subreddit`);
    }

    // 5. Rule Compliance Check (warn but don't completely block)
    if (!checkRuleCompliance(subreddit, topic)) {
      score *= 0.3; // Reduce score but don't set to 0
      reasons.push('Post type may not be ideal for subreddit rules');
    }

    return {
      subreddit_id: subreddit.id,
      score: Math.max(0, Math.min(1, score)),
      reasons,
    };
  });

  // Sort by score
  const sorted = scores.sort((a, b) => b.score - a.score);
  
  // Always return at least the top subreddit, even if score is low (for fallback)
  if (sorted.length === 0) {
    console.error('No subreddits available for selection');
    return [];
  }
  
  // If all scores are very low, still return top 3 for fallback
  if (sorted[0].score < 0.1) {
    console.warn(`All subreddit scores are very low (top score: ${sorted[0].score}), using top ${Math.min(3, sorted.length)} as fallback`);
    return sorted.slice(0, Math.min(3, sorted.length));
  }
  
  // Return all subreddits with score > 0, or at least the top one
  const valid = sorted.filter(s => s.score > 0);
  return valid.length > 0 ? valid : [sorted[0]]; // Always return at least one
}

function calculateRelevanceScore(
  subreddit: Subreddit,
  topic: GeneratedTopic
): number {
  // Simple keyword matching - in production, use more sophisticated NLP
  const subredditName = subreddit.name.toLowerCase();
  const topicLower = topic.topic.toLowerCase();

  // Extract keywords from subreddit name (remove 'r/' prefix)
  const subredditKeywords = subredditName
    .replace(/^r\//, '')
    .split(/[-_\s]/)
    .filter(k => k.length > 2);

  // Check if topic contains subreddit keywords
  let matches = 0;
  subredditKeywords.forEach(keyword => {
    if (topicLower.includes(keyword)) {
      matches++;
    }
  });

  // Base relevance on keyword matches
  const keywordScore = matches / Math.max(1, subredditKeywords.length);

  // Boost score if subreddit name suggests relevance
  let nameScore = 0;
  const relevantTerms = ['startup', 'business', 'marketing', 'entrepreneur', 'saas'];
  relevantTerms.forEach(term => {
    if (subredditName.includes(term) && topicLower.includes(term)) {
      nameScore += 0.2;
    }
  });

  return Math.min(1, keywordScore * 0.6 + nameScore * 0.4 + 0.3); // Base 0.3 relevance
}

function checkCooldown(
  subreddit: Subreddit,
  activity: SubredditActivity | undefined,
  targetDate: Date
): number {
  if (!activity || !activity.last_post_date) {
    return 1.0; // No previous posts, cooldown satisfied
  }

  const lastPostDate = new Date(activity.last_post_date);
  const daysSince = differenceInDays(targetDate, lastPostDate);

  if (daysSince >= subreddit.min_cooldown_days) {
    return 1.0; // Cooldown satisfied
  }

  // Partial score if close to cooldown - be more lenient (don't go to 0)
  const daysRemaining = subreddit.min_cooldown_days - daysSince;
  // Return at least 0.3 even if cooldown not met (allows fallback selection)
  return Math.max(0.3, 1 - (daysRemaining / subreddit.min_cooldown_days) * 0.7);
}

function checkFrequency(
  subreddit: Subreddit,
  activity: SubredditActivity | undefined,
  targetDate: Date
): number {
  if (!activity) {
    return 1.0; // No activity this week
  }

  // Check if activity is for the same week
  const activityWeek = new Date(activity.week_start_date);
  const targetWeek = getWeekStart(targetDate);
  const isSameWeek = activityWeek.getTime() === targetWeek.getTime();

  if (!isSameWeek) {
    return 1.0; // Different week, frequency reset
  }

  const remaining = subreddit.max_posts_per_week - activity.posts_this_week;
  if (remaining <= 0) {
    // Don't return 0 - return a low score so it can still be selected as fallback
    return 0.2; // Very low but not zero
  }

  return remaining / subreddit.max_posts_per_week;
}

function checkSizeAppropriateness(
  subreddit: Subreddit,
  topic: GeneratedTopic
): number {
  // Small subreddits prefer questions, large prefer stories/advice
  if (subreddit.size_category === 'small') {
    return topic.post_type === 'question' ? 1.0 : 0.7;
  } else if (subreddit.size_category === 'large') {
    return topic.post_type !== 'question' ? 1.0 : 0.7;
  }
  return 0.8; // Medium subreddits are flexible
}

function checkRuleCompliance(
  subreddit: Subreddit,
  topic: GeneratedTopic
): boolean {
  if (!subreddit.rules) {
    return true; // No rules specified, assume allowed
  }

  const rulesLower = subreddit.rules.toLowerCase();

  // Check for common restrictions
  if (topic.post_type === 'story' && rulesLower.includes('no personal stories')) {
    return false;
  }
  if (topic.post_type === 'advice' && rulesLower.includes('no advice posts')) {
    return false;
  }
  if (rulesLower.includes('no self-promotion') && topic.topic.toLowerCase().includes('my product')) {
    return false;
  }

  return true;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day; // Sunday = 0
  return new Date(d.setDate(diff));
}

/**
 * Updates subreddit activity after posting
 */
export function updateSubredditActivity(
  subredditId: string,
  companyId: string,
  postDate: Date,
  activities: SubredditActivity[]
): SubredditActivity {
  const weekStart = getWeekStart(postDate);
  const existing = activities.find(
    a => a.subreddit_id === subredditId &&
         a.company_id === companyId &&
         a.week_start_date === weekStart.toISOString().split('T')[0]
  );

  if (existing) {
    return {
      ...existing,
      last_post_date: postDate.toISOString().split('T')[0],
      posts_this_week: existing.posts_this_week + 1,
    };
  }

  return {
    id: '', // Will be generated by database
    subreddit_id: subredditId,
    company_id: companyId,
    last_post_date: postDate.toISOString().split('T')[0],
    posts_this_week: 1,
    week_start_date: weekStart.toISOString().split('T')[0],
    created_at: new Date().toISOString(),
  };
}

