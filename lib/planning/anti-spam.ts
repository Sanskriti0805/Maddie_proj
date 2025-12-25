/**
 * Anti-Spam and Safety Rules Module
 * Detects spam patterns, overposting risks, and repetition issues
 */

import type { CalendarPost, CalendarReply, Subreddit, Persona } from '@/types';

export interface SpamWarning {
  type: 'overposting' | 'repetition' | 'persona_imbalance' | 'wording_pattern' | 'topic_repetition';
  severity: 'low' | 'medium' | 'high';
  message: string;
  subreddit?: string;
  recommendation: string;
}

export interface SpamCheckResult {
  warnings: SpamWarning[];
  riskScore: number; // 0-10, higher = more risky
  passed: boolean;
}

/**
 * Comprehensive spam and safety check for a calendar
 */
export function checkSpamAndSafety(
  posts: CalendarPost[],
  replies: CalendarReply[],
  subreddits: Subreddit[],
  personas: Persona[],
  previousWeeksPosts?: CalendarPost[]
): SpamCheckResult {
  const warnings: SpamWarning[] = [];
  let riskScore = 0;

  // 1. Check overposting per subreddit
  const subredditCounts = new Map<string, number>();
  posts.forEach(post => {
    const count = subredditCounts.get(post.subreddit_id) || 0;
    subredditCounts.set(post.subreddit_id, count + 1);
  });

  subredditCounts.forEach((count, subredditId) => {
    const subreddit = subreddits.find(s => s.id === subredditId);
    if (!subreddit) return;

    if (count > subreddit.max_posts_per_week) {
      const severity = count > subreddit.max_posts_per_week * 1.5 ? 'high' : 'medium';
      warnings.push({
        type: 'overposting',
        severity,
        message: `⚠️ Risk of overposting in ${subreddit.name}. Currently ${count} posts, limit is ${subreddit.max_posts_per_week}.`,
        subreddit: subreddit.name,
        recommendation: `Reduce to ${subreddit.max_posts_per_week} posts or less.`,
      });
      riskScore += severity === 'high' ? 3 : 2;
    }
  });

  // 2. Check persona distribution
  const personaCounts = new Map<string, number>();
  posts.forEach(post => {
    const count = personaCounts.get(post.persona_id) || 0;
    personaCounts.set(post.persona_id, count + 1);
  });

  if (personaCounts.size > 1) {
    const counts = Array.from(personaCounts.values());
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    const imbalance = max - min;

    if (imbalance > posts.length * 0.4) {
      warnings.push({
        type: 'persona_imbalance',
        severity: 'medium',
        message: `Uneven persona distribution. Some personas posting ${max} times while others post ${min} times.`,
        recommendation: 'Distribute posts more evenly across personas.',
      });
      riskScore += 2;
    }
  }

  // 3. Check topic repetition
  const topicCounts = new Map<string, number>();
  posts.forEach(post => {
    const normalizedTopic = normalizeTopic(post.topic);
    const count = topicCounts.get(normalizedTopic) || 0;
    topicCounts.set(normalizedTopic, count + 1);
  });

  topicCounts.forEach((count, topic) => {
    if (count > 1) {
      warnings.push({
        type: 'topic_repetition',
        severity: count > 2 ? 'high' : 'medium',
        message: `Topic "${topic}" appears ${count} times this week.`,
        recommendation: 'Use more diverse topics to avoid repetition.',
      });
      riskScore += count > 2 ? 2 : 1;
    }
  });

  // 4. Check wording patterns
  const wordingPatterns = detectWordingPatterns(posts);
  wordingPatterns.forEach(pattern => {
    if (pattern.count > 2) {
      warnings.push({
        type: 'wording_pattern',
        severity: 'low',
        message: `Repeated wording pattern detected: "${pattern.text.substring(0, 50)}..."`,
        recommendation: 'Vary your language to sound more natural.',
      });
      riskScore += 1;
    }
  });

  // 5. Check against previous weeks for repetition
  if (previousWeeksPosts && previousWeeksPosts.length > 0) {
    const recentTopics = new Set(
      previousWeeksPosts
        .slice(-20) // Last 20 posts
        .map(p => normalizeTopic(p.topic))
    );

    posts.forEach(post => {
      const normalized = normalizeTopic(post.topic);
      if (recentTopics.has(normalized)) {
        warnings.push({
          type: 'topic_repetition',
          severity: 'low',
          message: `Topic similar to recent posts: "${post.topic.substring(0, 50)}..."`,
          recommendation: 'Use fresh topics to avoid appearing repetitive.',
        });
        riskScore += 0.5;
      }
    });
  }

  // 6. Check subreddit cooldown violations
  const subredditLastPost = new Map<string, Date>();
  posts.forEach(post => {
    const existing = subredditLastPost.get(post.subreddit_id);
    if (!existing) {
      subredditLastPost.set(post.subreddit_id, new Date());
    }
  });

  // Check consecutive posts in same subreddit
  const sortedPosts = [...posts].sort((a, b) => a.day_of_week - b.day_of_week);
  for (let i = 1; i < sortedPosts.length; i++) {
    if (
      sortedPosts[i].subreddit_id === sortedPosts[i - 1].subreddit_id &&
      sortedPosts[i].day_of_week - sortedPosts[i - 1].day_of_week < 2
    ) {
      const subreddit = subreddits.find(s => s.id === sortedPosts[i].subreddit_id);
      if (subreddit && subreddit.min_cooldown_days > 1) {
        warnings.push({
          type: 'overposting',
          severity: 'medium',
          message: `Posts too close together in ${subreddit.name}. Minimum cooldown: ${subreddit.min_cooldown_days} days.`,
          subreddit: subreddit.name,
          recommendation: `Space posts at least ${subreddit.min_cooldown_days} days apart.`,
        });
        riskScore += 2;
      }
    }
  }

  const passed = riskScore < 5 && warnings.filter(w => w.severity === 'high').length === 0;

  return {
    warnings,
    riskScore: Math.min(10, riskScore),
    passed,
  };
}

/**
 * Normalizes topic text for comparison
 */
function normalizeTopic(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detects repeated wording patterns across posts
 */
function detectWordingPatterns(posts: CalendarPost[]): Array<{ text: string; count: number }> {
  const phrases = new Map<string, number>();

  posts.forEach(post => {
    const text = (post.planned_title || post.topic || '').toLowerCase();
    const words = text.split(/\s+/).filter(w => w.length > 4); // Only words > 4 chars

    // Extract 3-word phrases
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      phrases.set(phrase, (phrases.get(phrase) || 0) + 1);
    }
  });

  const patterns: Array<{ text: string; count: number }> = [];
  phrases.forEach((count, phrase) => {
    if (count > 1) {
      patterns.push({ text: phrase, count });
    }
  });

  return patterns.sort((a, b) => b.count - a.count);
}

/**
 * Checks if a new post would violate spam rules
 */
export function wouldViolateSpamRules(
  newPost: Partial<CalendarPost>,
  existingPosts: CalendarPost[],
  subreddit: Subreddit,
  allSubreddits: Subreddit[]
): { violates: boolean; reason?: string } {
  // Check subreddit limit
  const postsInSubreddit = existingPosts.filter(p => p.subreddit_id === subreddit.id);
  if (postsInSubreddit.length >= subreddit.max_posts_per_week) {
    return {
      violates: true,
      reason: `Subreddit ${subreddit.name} already has ${subreddit.max_posts_per_week} posts this week (limit reached)`,
    };
  }

  // Check cooldown
  if (postsInSubreddit.length > 0 && newPost.day_of_week !== undefined) {
    const lastPost = postsInSubreddit[postsInSubreddit.length - 1];
    const daysBetween = Math.abs(newPost.day_of_week - lastPost.day_of_week);
    if (daysBetween < subreddit.min_cooldown_days) {
      return {
        violates: true,
        reason: `Cooldown period not met. Last post was ${daysBetween} days ago, need ${subreddit.min_cooldown_days} days`,
      };
    }
  }

  return { violates: false };
}

