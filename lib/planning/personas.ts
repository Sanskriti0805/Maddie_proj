import type { Persona, GeneratedTopic, CalendarPost, PersonaAssignment } from '@/types';
import { addDays, differenceInDays } from 'date-fns';

interface PersonaAssignmentParams {
  personas: Persona[];
  topic: GeneratedTopic;
  recentPosts: CalendarPost[]; // Posts from last 7 days
  targetDate: Date;
  subredditId: string;
}

/**
 * Assigns the best persona for a post based on expertise, tone, and activity
 */
export function assignPersona(
  params: PersonaAssignmentParams
): PersonaAssignment | null {
  const { personas, topic, recentPosts, targetDate, subredditId } = params;

  if (personas.length === 0) {
    return null;
  }

  const assignments: PersonaAssignment[] = personas.map(persona => {
    const reasons: string[] = [];
    let score = 0;

    // 1. Expertise Match (40% weight)
    const expertiseScore = calculateExpertiseMatch(persona, topic);
    score += expertiseScore * 0.4;
    if (expertiseScore > 0.7) {
      reasons.push('Strong expertise match');
    } else if (expertiseScore < 0.3) {
      reasons.push('Weak expertise match');
    }

    // 2. Tone Consistency (30% weight)
    const toneScore = calculateToneMatch(persona, topic);
    score += toneScore * 0.3;
    if (toneScore > 0.8) {
      reasons.push(`Tone matches ${persona.tone}`);
    }

    // 3. Activity Rotation (20% weight)
    const rotationScore = calculateRotationScore(persona, recentPosts, targetDate);
    score += rotationScore * 0.2;
    if (rotationScore > 0.8) {
      reasons.push('Good rotation balance');
    } else if (rotationScore < 0.3) {
      reasons.push('Recently active, needs rest');
    }

    // 4. Subreddit Collision Check (10% weight)
    const collisionScore = checkSubredditCollision(persona, recentPosts, subredditId, targetDate);
    score += collisionScore * 0.1;
    if (collisionScore === 0) {
      reasons.push('Recent post in same subreddit');
    }

    return {
      persona_id: persona.id,
      score: Math.max(0, Math.min(1, score)),
      reasons,
    };
  });

  // Filter out personas with collision issues
  const validAssignments = assignments.filter(a => {
    const persona = personas.find(p => p.id === a.persona_id);
    if (!persona) return false;
    const collision = checkSubredditCollision(persona, recentPosts, subredditId, targetDate);
    return collision > 0; // Only allow if no collision
  });

  if (validAssignments.length === 0) {
    // If all personas have collisions, return the one with best score anyway
    // (edge case - might need to delay post)
    return assignments.sort((a, b) => b.score - a.score)[0] || null;
  }

  // Sort by score and return best
  return validAssignments.sort((a, b) => b.score - a.score)[0];
}

function calculateExpertiseMatch(persona: Persona, topic: GeneratedTopic): number {
  if (persona.expertise.length === 0) {
    return 0.5; // Neutral if no expertise specified
  }

  const topicLower = topic.topic.toLowerCase();
  let matches = 0;

  persona.expertise.forEach(area => {
    const areaLower = area.toLowerCase();
    // Check if topic contains expertise keywords
    if (topicLower.includes(areaLower)) {
      matches++;
    }
    // Also check for related terms
    const relatedTerms: Record<string, string[]> = {
      marketing: ['growth', 'acquisition', 'conversion', 'campaign'],
      sales: ['revenue', 'clients', 'prospects', 'pipeline'],
      product: ['feature', 'development', 'roadmap', 'user experience'],
      startup: ['founder', 'funding', 'mvp', 'launch'],
    };

    if (relatedTerms[areaLower]) {
      relatedTerms[areaLower].forEach(term => {
        if (topicLower.includes(term)) {
          matches += 0.5;
        }
      });
    }
  });

  return Math.min(1, matches / persona.expertise.length);
}

function calculateToneMatch(persona: Persona, topic: GeneratedTopic): number {
  const toneLower = persona.tone.toLowerCase();

  // Map post types to preferred tones
  const tonePostTypeMap: Record<string, Array<'question' | 'story' | 'advice'>> = {
    helpful: ['advice', 'question'],
    curious: ['question', 'story'],
    experienced: ['story', 'advice'],
    expert: ['advice'],
    beginner: ['question'],
    friendly: ['story', 'question'],
  };

  const preferredTypes = tonePostTypeMap[toneLower] || ['question', 'story', 'advice'];

  if (preferredTypes.includes(topic.post_type)) {
    return 1.0;
  }

  return 0.6; // Partial match
}

function calculateRotationScore(
  persona: Persona,
  recentPosts: CalendarPost[],
  targetDate: Date
): number {
  const personaPosts = recentPosts.filter(p => p.persona_id === persona.id);
  const daysBack = 7;
  const cutoffDate = addDays(targetDate, -daysBack);

  // Count posts in last 7 days
  const recentCount = personaPosts.filter(p => {
    const postDate = new Date(p.created_at);
    return postDate >= cutoffDate;
  }).length;

  // Ideal: 1-2 posts per week per persona
  if (recentCount === 0) {
    return 1.0; // No recent posts, good to use
  } else if (recentCount === 1) {
    return 0.8; // One post, still good
  } else if (recentCount === 2) {
    return 0.5; // Two posts, getting busy
  } else {
    return 0.2; // Too many posts, should rest
  }
}

function checkSubredditCollision(
  persona: Persona,
  recentPosts: CalendarPost[],
  subredditId: string,
  targetDate: Date
): number {
  const daysBack = 3; // Check last 3 days for collisions
  const cutoffDate = addDays(targetDate, -daysBack);

  const collisionPosts = recentPosts.filter(p => {
    if (p.persona_id !== persona.id) return false;
    if (p.subreddit_id !== subredditId) return false;
    const postDate = new Date(p.created_at);
    return postDate >= cutoffDate;
  });

  if (collisionPosts.length > 0) {
    return 0; // Collision detected
  }

  return 1.0; // No collision
}

/**
 * Gets persona posting frequency for the week
 */
export function getPersonaPostCount(
  personaId: string,
  posts: CalendarPost[],
  weekStart: Date
): number {
  const weekEnd = addDays(weekStart, 7);
  return posts.filter(p => {
    if (p.persona_id !== personaId) return false;
    const postDate = new Date(p.created_at);
    return postDate >= weekStart && postDate < weekEnd;
  }).length;
}

