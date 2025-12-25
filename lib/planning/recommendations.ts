/**
 * Smart Recommendations Module
 * Provides actionable recommendations based on calendar analysis
 */

import type { CalendarPost, Subreddit, Persona, ContentCalendar } from '@/types';

export interface Recommendation {
  type: 'subreddit_performance' | 'post_type_optimization' | 'persona_balance' | 'timing_optimization' | 'topic_diversity';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  action?: string;
}

/**
 * Generates smart recommendations for a calendar
 */
export function generateRecommendations(
  calendar: ContentCalendar,
  posts: CalendarPost[],
  subreddits: Subreddit[],
  personas: Persona[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // 1. Subreddit performance recommendations
  const subredditPostCounts = new Map<string, number>();
  posts.forEach(post => {
    const count = subredditPostCounts.get(post.subreddit_id) || 0;
    subredditPostCounts.set(post.subreddit_id, count + 1);
  });

  subreddits.forEach(subreddit => {
    const postCount = subredditPostCounts.get(subreddit.id) || 0;
    const postTypes = posts
      .filter(p => p.subreddit_id === subreddit.id)
      .map(p => p.post_type);

    // Check if certain post types perform better
    const tutorialCount = postTypes.filter(t => t === 'advice').length;
    if (tutorialCount > postCount * 0.6 && postCount > 2) {
      recommendations.push({
        type: 'subreddit_performance',
        priority: 'medium',
        title: `${subreddit.name} performs well with tutorials`,
        message: `${subreddit.name} has ${tutorialCount} tutorial/advice posts out of ${postCount} total. Consider adding more tutorial-style content.`,
        action: `Focus on advice posts in ${subreddit.name}`,
      });
    }
  });

  // 2. Post type optimization
  const postTypeCounts = new Map<string, number>();
  posts.forEach(post => {
    postTypeCounts.set(post.post_type, (postTypeCounts.get(post.post_type) || 0) + 1);
  });

  const questionCount = postTypeCounts.get('question') || 0;
  const storyCount = postTypeCounts.get('story') || 0;
  const adviceCount = postTypeCounts.get('advice') || 0;

  if (questionCount > (posts.length * 0.6)) {
    recommendations.push({
      type: 'post_type_optimization',
      priority: 'medium',
      title: 'Too many question posts',
      message: `${questionCount} out of ${posts.length} posts are questions. Mix in more stories and advice for better engagement.`,
      action: 'Add more story and advice posts',
    });
  }

  // 3. Persona balance
  const personaCounts = new Map<string, number>();
  posts.forEach(post => {
    personaCounts.set(post.persona_id, (personaCounts.get(post.persona_id) || 0) + 1);
  });

  if (personaCounts.size > 1) {
    const counts = Array.from(personaCounts.values());
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    const imbalance = max - min;

    if (imbalance > posts.length * 0.3) {
      recommendations.push({
        type: 'persona_balance',
        priority: 'high',
        title: 'Uneven persona distribution',
        message: `Some personas are posting ${max} times while others post ${min} times. Distribute posts more evenly.`,
        action: 'Balance persona assignments',
      });
    }
  }

  // 4. Timing optimization
  const dayDistribution = [0, 0, 0, 0, 0, 0, 0];
  posts.forEach(post => {
    dayDistribution[post.day_of_week]++;
  });

  const weekdayPosts = dayDistribution.slice(1, 6).reduce((a, b) => a + b, 0);
  const weekendPosts = dayDistribution[0] + dayDistribution[6];

  if (weekendPosts > weekdayPosts * 0.5) {
    recommendations.push({
      type: 'timing_optimization',
      priority: 'low',
      title: 'Consider weekday focus',
      message: `${weekendPosts} posts on weekends vs ${weekdayPosts} on weekdays. Weekdays typically have higher engagement.`,
      action: 'Shift more posts to weekdays',
    });
  }

  // 5. Topic diversity
  const uniqueTopics = new Set(posts.map(p => p.topic));
  const diversityRatio = uniqueTopics.size / posts.length;

  if (diversityRatio < 0.8) {
    recommendations.push({
      type: 'topic_diversity',
      priority: 'high',
      title: 'Low topic diversity',
      message: `Only ${uniqueTopics.size} unique topics out of ${posts.length} posts. Add more variety to avoid repetition.`,
      action: 'Generate more diverse topics',
    });
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}

