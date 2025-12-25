import OpenAI from 'openai';
import type { CalendarPost, Persona, ReplyPlan } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ConversationPlanningParams {
  posts: CalendarPost[];
  personas: Persona[];
  postPersonaMap: Map<string, string>; // post_id -> persona_id
}

export interface EnhancedReplyPlan extends ReplyPlan {
  tone?: string;
  emotion?: 'curious' | 'supportive' | 'skeptical' | 'excited' | 'neutral';
  planned_content?: string;
}

/**
 * Plans replies for posts to create natural conversations
 * Strategy: 60-70% of posts get replies, varied timing and intents
 */
export function planReplies(
  params: ConversationPlanningParams
): Map<string, ReplyPlan> {
  const { posts, personas, postPersonaMap } = params;
  const replyPlans = new Map<string, ReplyPlan>();

  // Determine which posts get replies (60-70% of posts)
  const replyRate = 0.65;
  const postsToReply = posts.filter(() => Math.random() < replyRate);

  // Shuffle to avoid patterns
  const shuffled = [...postsToReply].sort(() => Math.random() - 0.5);

  shuffled.forEach(post => {
    const postPersonaId = postPersonaMap.get(post.id);
    if (!postPersonaId) return;

    // Find a different persona to reply
    const availablePersonas = personas.filter(p => p.id !== postPersonaId);

    if (availablePersonas.length === 0) {
      return; // No other personas available
    }

    // Select persona with some intelligence (not purely random)
    const replyPersona = selectReplyPersona(availablePersonas, post);

    // Determine intent based on post type
    const intent = selectIntent(post.post_type);

    // Determine timing (hours after post) - more variable
    const hoursAfterPost = selectTiming(intent);

    // Select tone and emotion
    const { tone, emotion } = selectToneAndEmotion(replyPersona, intent, post.post_type);

    replyPlans.set(post.id, {
      persona_id: replyPersona.id,
      intent,
      hours_after_post: hoursAfterPost,
      tone,
      emotion,
    } as EnhancedReplyPlan);
  });

  return replyPlans;
}

function selectIntent(postType: 'question' | 'story' | 'advice'): ReplyPlan['intent'] {
  // Map post types to likely reply intents
  const intentMap: Record<string, Array<ReplyPlan['intent']>> = {
    question: ['add_value', 'clarify', 'ask'],
    story: ['add_value', 'challenge', 'ask'],
    advice: ['challenge', 'add_value', 'clarify'],
  };

  const intents = intentMap[postType] || ['add_value', 'ask', 'clarify'];
  // Weighted random selection
  const weights = [0.5, 0.3, 0.2]; // First intent most likely
  const rand = Math.random();
  let cumulative = 0;

  for (let i = 0; i < intents.length; i++) {
    cumulative += weights[i];
    if (rand < cumulative) {
      return intents[i];
    }
  }

  return intents[0];
}

function selectTiming(intent: ReplyPlan['intent']): number {
  // Timing strategy based on intent - more variability for realism
  const timingMap: Record<ReplyPlan['intent'], { min: number; max: number }> = {
    ask: { min: 1, max: 6 }, // Quick questions
    challenge: { min: 8, max: 24 }, // Thoughtful challenges take time
    add_value: { min: 3, max: 12 }, // Variable timing
    clarify: { min: 0.5, max: 4 }, // Quick clarifications
  };

  const range = timingMap[intent] || { min: 2, max: 6 };
  // Add more randomness - not all replies happen at exact intervals
  const baseHours = range.min + Math.random() * (range.max - range.min);
  // Add some variance (±30%)
  const variance = baseHours * 0.3 * (Math.random() - 0.5);
  return Math.max(0.5, Math.round((baseHours + variance) * 2) / 2); // Round to 0.5 hour increments
}

/**
 * Selects tone and emotion for reply based on persona and intent
 */
export function selectToneAndEmotion(
  persona: Persona,
  intent: ReplyPlan['intent'],
  postType: CalendarPost['post_type']
): { tone: string; emotion: 'curious' | 'supportive' | 'skeptical' | 'excited' | 'neutral' } {
  const personaTone = persona.tone.toLowerCase();
  
  // Map persona tone to reply tone
  const toneMap: Record<string, string> = {
    helpful: 'supportive and informative',
    experienced: 'authoritative but humble',
    curious: 'inquisitive and engaged',
    expert: 'knowledgeable and precise',
    beginner: 'humble and learning',
    friendly: 'warm and conversational',
  };

  const baseTone = toneMap[personaTone] || 'helpful';

  // Select emotion based on intent and persona
  let emotion: 'curious' | 'supportive' | 'skeptical' | 'excited' | 'neutral';
  
  if (intent === 'challenge') {
    emotion = personaTone === 'experienced' || personaTone === 'expert' ? 'skeptical' : 'curious';
  } else if (intent === 'ask') {
    emotion = 'curious';
  } else if (intent === 'add_value') {
    emotion = personaTone === 'friendly' ? 'excited' : 'supportive';
  } else {
    emotion = 'supportive';
  }

  // Allow some disagreement/challenge even for supportive personas (realistic)
  if (Math.random() < 0.15 && intent !== 'challenge') {
    emotion = 'skeptical';
  }

  return { tone: baseTone, emotion };
}

/**
 * Generates realistic reply content using AI
 */
export async function generateReplyContent(
  post: CalendarPost,
  persona: Persona,
  intent: ReplyPlan['intent'],
  tone: string,
  emotion: string
): Promise<string> {
  try {
    const prompt = `You are a Reddit user with the following persona:
- Name: ${persona.name}
- Tone: ${persona.tone}
- Expertise: ${persona.expertise.join(', ')}

You are replying to this Reddit post:
Title: ${post.planned_title || post.topic}
Body: ${post.planned_body || 'N/A'}
Type: ${post.post_type}

Your reply intent: ${intent}
Your tone should be: ${tone}
Your emotion: ${emotion}

Generate a realistic Reddit comment that:
1. Feels natural and human (not robotic)
2. Matches your persona's tone and expertise
3. Fulfills the ${intent} intent
4. Shows ${emotion} emotion appropriately
5. Is conversational (2-4 sentences typically)
6. Does NOT mention products or services directly
7. Could include mild disagreement or curiosity if appropriate
8. Uses natural Reddit language (can be casual, use "I", share experiences)

Return ONLY the comment text, no quotes or formatting.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a Reddit user generating authentic, natural comments. Never sound promotional or salesy.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content?.trim();
    return content || generateFallbackReply(intent, tone);
  } catch (error) {
    console.error('Error generating reply content:', error);
    return generateFallbackReply(intent, tone);
  }
}

function generateFallbackReply(intent: ReplyPlan['intent'], tone: string): string {
  const fallbacks: Record<ReplyPlan['intent'], string> = {
    ask: 'That\'s a great question. I\'m curious about this too - has anyone else experienced something similar?',
    challenge: 'Interesting perspective. I\'ve seen it work differently in my experience - what do you think about [alternative approach]?',
    add_value: 'This is really helpful. One thing that worked for me was [related tip]. Hope that helps!',
    clarify: 'Just to clarify - are you asking about [specific aspect]? I want to make sure I understand correctly.',
  };

  return fallbacks[intent] || 'Thanks for sharing this. Looking forward to seeing what others think.';
}

/**
 * Validates reply plans to ensure no coordination patterns
 */
export function validateReplyPlans(
  replyPlans: Map<string, ReplyPlan>,
  posts: CalendarPost[],
  postPersonaMap: Map<string, string>
): Map<string, ReplyPlan> {
  const validated = new Map<string, ReplyPlan>();

  // Track persona reply patterns
  const personaReplyCounts = new Map<string, number>();

  replyPlans.forEach((plan, postId) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const postPersonaId = postPersonaMap.get(postId);
    if (!postPersonaId) return;

    // Check: Persona cannot reply to own post
    if (plan.persona_id === postPersonaId) {
      return; // Skip this reply
    }

    // Check: Limit replies per persona (max 3 per week)
    const currentCount = personaReplyCounts.get(plan.persona_id) || 0;
    if (currentCount >= 3) {
      return; // Skip to avoid over-replying
    }

    // Check: No two personas reply to same post (only one reply per post)
    // This is already handled by only creating one reply per post

    validated.set(postId, plan);
    personaReplyCounts.set(plan.persona_id, currentCount + 1);
  });

  return validated;
}

/**
 * Selects a persona to reply, considering expertise match and variety
 */
function selectReplyPersona(availablePersonas: Persona[], post: CalendarPost): Persona {
  // Score personas based on how well they match the post
  const scored = availablePersonas.map(persona => {
    let score = 0.5; // Base score

    // Boost if expertise matches topic
    const topicLower = (post.topic || '').toLowerCase();
    persona.expertise.forEach(exp => {
      if (topicLower.includes(exp.toLowerCase())) {
        score += 0.3;
      }
    });

    // Slight preference for different tones (creates variety)
    if (persona.tone !== 'helpful') {
      score += 0.1;
    }

    return { persona, score };
  });

  // Weighted random selection (favor higher scores but allow variety)
  scored.sort((a, b) => b.score - a.score);
  const topCandidates = scored.slice(0, Math.min(3, scored.length));
  const selected = topCandidates[Math.floor(Math.random() * topCandidates.length)];
  
  return selected.persona;
}

