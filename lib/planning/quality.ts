import type {
  ContentCalendar,
  CalendarPost,
  CalendarReply,
  CalendarQualityScore,
  Subreddit,
  Persona,
} from '@/types';
import { checkSpamAndSafety } from './anti-spam';

interface QualityEvaluationParams {
  calendar: ContentCalendar;
  posts: CalendarPost[];
  replies: CalendarReply[];
  subreddits?: Subreddit[];
  personas?: Persona[];
  previousWeeksPosts?: CalendarPost[];
}

/**
 * Enhanced quality evaluation with comprehensive metrics
 * Returns a score from 0-10 with detailed breakdown
 */
export function evaluateCalendarQuality(
  params: QualityEvaluationParams
): CalendarQualityScore {
  const { posts, replies, subreddits = [], personas = [], previousWeeksPosts = [] } = params;

  const issues: string[] = [];
  let topicDiversity = 0;
  let personaRotation = 0;
  let subredditDistribution = 0;
  let replyNaturalness = 0;
  let realism = 0;
  let subredditFit = 0;
  let spamRisk = 0;
  let personaDistinctiveness = 0;

  // 1. Topic Diversity (0-10)
  const uniqueTopics = new Set(posts.map(p => p.topic));
  const diversityRatio = uniqueTopics.size / posts.length;
  topicDiversity = diversityRatio * 10;
  if (diversityRatio < 0.8) {
    issues.push('Low topic diversity - some topics repeated');
  }

  // 2. Persona Rotation (0-10)
  const personaCounts = new Map<string, number>();
  posts.forEach(p => {
    personaCounts.set(p.persona_id, (personaCounts.get(p.persona_id) || 0) + 1);
  });

  const personaValues = Array.from(personaCounts.values());
  if (personaValues.length > 1) {
    const min = Math.min(...personaValues);
    const max = Math.max(...personaValues);
    const variance = max - min;
    const avg = personaValues.reduce((a, b) => a + b, 0) / personaValues.length;
    const varianceRatio = variance / avg;
    personaRotation = Math.max(0, 10 - varianceRatio * 20); // Penalize high variance
  } else {
    personaRotation = 5; // Only one persona, neutral score
  }

  if (personaRotation < 6) {
    issues.push('Uneven persona distribution');
  }

  // Check for persona patterns (same persona multiple days in a row)
  let consecutiveSamePersona = 0;
  for (let i = 1; i < posts.length; i++) {
    if (posts[i].persona_id === posts[i - 1].persona_id) {
      consecutiveSamePersona++;
    }
  }
  if (consecutiveSamePersona > posts.length * 0.3) {
    issues.push('Personas posting consecutively too often');
    personaRotation -= 2;
  }

  // 3. Subreddit Distribution (0-10)
  const subredditCounts = new Map<string, number>();
  posts.forEach(p => {
    subredditCounts.set(p.subreddit_id, (subredditCounts.get(p.subreddit_id) || 0) + 1);
  });

  const subredditValues = Array.from(subredditCounts.values());
  if (subredditValues.length > 1) {
    const max = Math.max(...subredditValues);
    const avg = subredditValues.reduce((a, b) => a + b, 0) / subredditValues.length;
    const concentrationRatio = max / avg;
    subredditDistribution = Math.max(0, 10 - (concentrationRatio - 1) * 5);
  } else {
    subredditDistribution = 5;
  }

  if (subredditDistribution < 6) {
    issues.push('Posts concentrated in too few subreddits');
  }

  // 4. Reply Naturalness (0-10)
  const replyRate = replies.length / posts.length;
  if (replyRate < 0.5 || replyRate > 0.8) {
    issues.push(`Reply rate ${(replyRate * 100).toFixed(0)}% - should be 60-70%`);
    replyNaturalness = 5;
  } else {
    replyNaturalness = 8;
  }

  // Check reply timing distribution
  const replyTimings = replies.map(r => r.order_after_post);
  const timingVariance = calculateVariance(replyTimings);
  if (timingVariance < 2) {
    issues.push('Reply timings too uniform');
    replyNaturalness -= 2;
  }

  // Check for reply intent diversity
  const intentCounts = new Map<string, number>();
  replies.forEach(r => {
    intentCounts.set(r.intent, (intentCounts.get(r.intent) || 0) + 1);
  });
  if (intentCounts.size < 3) {
    issues.push('Limited reply intent variety');
    replyNaturalness -= 1;
  }

  // Check for self-replies (should be 0)
  const postPersonaMap = new Map(posts.map(p => [p.id, p.persona_id]));
  const selfReplies = replies.filter(r => {
    const post = posts.find(p => p.id === r.post_id);
    return post && post.persona_id === r.persona_id;
  });
  if (selfReplies.length > 0) {
    issues.push(`${selfReplies.length} self-replies detected`);
    replyNaturalness -= 3;
  }

  replyNaturalness = Math.max(0, Math.min(10, replyNaturalness));

  // 5. Realism Score (0-10)
  realism = evaluateRealism(posts, replies);
  if (realism < 7) {
    issues.push('Content may feel too robotic or formulaic');
  }

  // 6. Subreddit Fit Score (0-10)
  if (subreddits.length > 0) {
    subredditFit = evaluateSubredditFit(posts, subreddits);
    if (subredditFit < 6) {
      issues.push('Some posts may not match subreddit culture');
    }
  } else {
    subredditFit = 5; // Neutral if no subreddit data
  }

  // 7. Spam Risk Score (0-10, inverted - lower risk = higher score)
  if (subreddits.length > 0 && personas.length > 0) {
    const spamCheck = checkSpamAndSafety(posts, replies, subreddits, personas, previousWeeksPosts);
    spamRisk = Math.max(0, 10 - spamCheck.riskScore);
    if (spamCheck.riskScore > 5) {
      issues.push(`High spam risk detected (${spamCheck.riskScore.toFixed(1)}/10)`);
    }
  } else {
    spamRisk = 5; // Neutral if no data
  }

  // 8. Persona Distinctiveness (0-10)
  if (personas.length > 1) {
    personaDistinctiveness = evaluatePersonaDistinctiveness(posts, replies, personas);
    if (personaDistinctiveness < 6) {
      issues.push('Personas may not be distinct enough in their posting patterns');
    }
  } else {
    personaDistinctiveness = 5; // Neutral if only one persona
  }

  // Overall score (weighted average with new metrics)
  const overall = (
    topicDiversity * 0.15 +
    personaRotation * 0.15 +
    subredditDistribution * 0.15 +
    replyNaturalness * 0.15 +
    realism * 0.15 +
    subredditFit * 0.10 +
    spamRisk * 0.10 +
    personaDistinctiveness * 0.05
  );

  return {
    overall: Math.round(overall * 10) / 10,
    topic_diversity: Math.round(topicDiversity * 10) / 10,
    persona_rotation: Math.round(personaRotation * 10) / 10,
    subreddit_distribution: Math.round(subredditDistribution * 10) / 10,
    reply_naturalness: Math.round(replyNaturalness * 10) / 10,
    realism: Math.round(realism * 10) / 10,
    subreddit_fit: Math.round(subredditFit * 10) / 10,
    spam_risk: Math.round(spamRisk * 10) / 10,
    persona_distinctiveness: Math.round(personaDistinctiveness * 10) / 10,
    issues,
  };
}

/**
 * Evaluates how realistic and natural the content feels
 */
function evaluateRealism(posts: CalendarPost[], replies: CalendarReply[]): number {
  let score = 5; // Base score

  // Check for variety in post types
  const postTypeCounts = new Map<string, number>();
  posts.forEach(p => {
    postTypeCounts.set(p.post_type, (postTypeCounts.get(p.post_type) || 0) + 1);
  });
  if (postTypeCounts.size >= 2) {
    score += 2; // Good variety in post types
  }

  // Check reply content quality
  const repliesWithContent = replies.filter(r => r.planned_content && r.planned_content.length > 20);
  const replyContentRatio = repliesWithContent.length / Math.max(1, replies.length);
  score += replyContentRatio * 2; // Up to +2 for having actual content

  // Check for natural timing variation
  const replyTimings = replies.map(r => r.order_after_post);
  const timingVariance = calculateVariance(replyTimings);
  if (timingVariance > 5) {
    score += 1; // Good timing variation
  }

  // Check for strategy variety (if available)
  const strategies = posts.map(p => (p as any).posting_strategy).filter(Boolean);
  if (strategies.length > 0) {
    const uniqueStrategies = new Set(strategies);
    if (uniqueStrategies.size >= 3) {
      score += 1; // Good strategy variety
    }
  }

  return Math.min(10, Math.max(0, score));
}

/**
 * Evaluates how well posts fit subreddit culture
 */
function evaluateSubredditFit(posts: CalendarPost[], subreddits: Subreddit[]): number {
  if (posts.length === 0) return 5;

  let totalFit = 0;
  let checkedPosts = 0;

  posts.forEach(post => {
    const subreddit = subreddits.find(s => s.id === post.subreddit_id);
    if (!subreddit) return;

    let fit = 5; // Base fit

    // Check if post type matches subreddit preferences
    const preferredTypes = (subreddit as any).preferred_post_types || ['question', 'story', 'advice'];
    if (preferredTypes.includes(post.post_type)) {
      fit += 2;
    }

    // Check culture tone match (if available)
    const cultureTone = (subreddit as any).culture_tone || 'casual';
    // This is a simplified check - in production, use NLP to match tone
    if (cultureTone === 'casual' && post.post_type !== 'advice') {
      fit += 1;
    } else if (cultureTone === 'professional' && post.post_type === 'advice') {
      fit += 1;
    }

    totalFit += fit;
    checkedPosts++;
  });

  return checkedPosts > 0 ? totalFit / checkedPosts : 5;
}

/**
 * Evaluates how distinct personas are in their posting
 */
function evaluatePersonaDistinctiveness(
  posts: CalendarPost[],
  replies: CalendarReply[],
  personas: Persona[]
): number {
  if (personas.length < 2) return 5;

  // Group posts by persona
  const personaPosts = new Map<string, CalendarPost[]>();
  posts.forEach(post => {
    const personaPostsList = personaPosts.get(post.persona_id) || [];
    personaPostsList.push(post);
    personaPosts.set(post.persona_id, personaPostsList);
  });

  // Check if personas use different post types
  const personaPostTypes = new Map<string, Set<string>>();
  personaPosts.forEach((posts, personaId) => {
    const types = new Set(posts.map(p => p.post_type));
    personaPostTypes.set(personaId, types);
  });

  let distinctiveness = 5;
  const typeSets = Array.from(personaPostTypes.values());
  if (typeSets.length > 1) {
    // Check overlap - less overlap = more distinct
    let overlaps = 0;
    for (let i = 0; i < typeSets.length; i++) {
      for (let j = i + 1; j < typeSets.length; j++) {
        const intersection = new Set([...typeSets[i]].filter(x => typeSets[j].has(x)));
        if (intersection.size > 0) overlaps++;
      }
    }
    const totalPairs = (typeSets.length * (typeSets.length - 1)) / 2;
    const overlapRatio = totalPairs > 0 ? overlaps / totalPairs : 0;
    distinctiveness = 10 - (overlapRatio * 5); // Penalize high overlap
  }

  return Math.max(0, Math.min(10, distinctiveness));
}

function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}

