import OpenAI from 'openai';
import type { Company, SEOQuery, TopicHistory, GeneratedTopic } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface TopicGenerationParams {
  company: Company;
  seoQueries: SEOQuery[];
  topicHistory: TopicHistory[];
  count: number;
}

/**
 * Generates topics using OpenAI, filtered for relevance and freshness
 */
export async function generateTopics(
  params: TopicGenerationParams
): Promise<GeneratedTopic[]> {
  const { company, seoQueries, topicHistory, count } = params;

  // Build context for topic generation
  const recentTopics = topicHistory
    .filter(t => {
      if (!t.last_used_date) return false;
      const daysSince = (Date.now() - new Date(t.last_used_date).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince < 28; // Last 4 weeks
    })
    .map(t => t.topic)
    .slice(0, 10);

  const seoQueryText = seoQueries
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5)
    .map(q => q.query)
    .join(', ');

  const prompt = `You are a Reddit content strategist. Generate ${count * 2} Reddit post topic ideas for a company.

Company: ${company.name}
Description: ${company.description || 'N/A'}
Target Users: ${company.target_users.join(', ')}
Pain Points: ${company.pain_points.join(', ')}
Tone: ${company.tone_positioning || 'helpful and authentic'}

SEO Queries to Target: ${seoQueryText || 'None specified'}

Recent Topics (avoid similar): ${recentTopics.join(', ') || 'None'}

Requirements:
1. Topics must feel NATURAL for Reddit - not salesy or promotional
2. Mix of question posts, story posts, and advice posts
3. Topics should help the target users solve their pain points
4. Avoid obvious product promotion
5. Make topics engaging and discussion-worthy

For each topic, provide:
- The topic/question/story idea
- Post type (question/story/advice)
- Why it's relevant

Format as JSON array:
[
  {
    "topic": "How do you handle X when Y?",
    "post_type": "question",
    "relevance": "Addresses pain point Z"
  }
]`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert Reddit content strategist. Generate authentic, non-salesy topics that drive organic engagement.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    // Handle both {topics: [...]} and [...] formats
    const topics = Array.isArray(parsed) 
      ? parsed 
      : (Array.isArray(parsed.topics) ? parsed.topics : []);

    // Filter and score topics
    const generated: GeneratedTopic[] = topics
      .slice(0, count * 2) // Generate more than needed for filtering
      .map((t: any) => ({
        topic: t.topic || t.title || '',
        relevance_score: calculateRelevanceScore(t.topic || '', company),
        post_type: (t.post_type || 'question') as 'question' | 'story' | 'advice',
      }))
      .filter(t => {
        // Filter out salesy language
        const salesyKeywords = ['buy', 'purchase', 'sign up', 'try now', 'get started', 'free trial'];
        const lowerTopic = t.topic.toLowerCase();
        return !salesyKeywords.some(keyword => lowerTopic.includes(keyword));
      })
      .filter(t => {
        // Check against recent topics (fuzzy match)
        return !recentTopics.some(recent => {
          const similarity = calculateSimilarity(t.topic, recent);
          return similarity > 0.7; // 70% similarity threshold
        });
      })
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, count);

    return generated;
  } catch (error) {
    console.error('Error generating topics:', error);
    // Fallback to simple topic generation
    return generateFallbackTopics(company, count);
  }
}

function calculateRelevanceScore(topic: string, company: Company): number {
  let score = 0.5; // Base score

  // Check if topic mentions pain points
  company.pain_points.forEach(pain => {
    if (topic.toLowerCase().includes(pain.toLowerCase())) {
      score += 0.2;
    }
  });

  // Check if topic mentions target users
  company.target_users.forEach(user => {
    if (topic.toLowerCase().includes(user.toLowerCase())) {
      score += 0.1;
    }
  });

  // Penalize salesy language
  const salesyKeywords = ['buy', 'purchase', 'sign up', 'try now'];
  salesyKeywords.forEach(keyword => {
    if (topic.toLowerCase().includes(keyword)) {
      score -= 0.3;
    }
  });

  return Math.min(1.0, Math.max(0, score));
}

function calculateSimilarity(str1: string, str2: string): number {
  const words1 = str1.toLowerCase().split(/\s+/);
  const words2 = str2.toLowerCase().split(/\s+/);
  const intersection = words1.filter(w => words2.includes(w));
  const union = [...new Set([...words1, ...words2])];
  return intersection.length / union.length;
}

function generateFallbackTopics(company: Company, count: number): GeneratedTopic[] {
  const topics: GeneratedTopic[] = [];
  const postTypes: Array<'question' | 'story' | 'advice'> = ['question', 'story', 'advice'];

  for (let i = 0; i < count; i++) {
    const painPoint = company.pain_points[i % company.pain_points.length] || 'challenges';
    const postType = postTypes[i % postTypes.length];

    let topic = '';
    if (postType === 'question') {
      topic = `How do you handle ${painPoint}?`;
    } else if (postType === 'story') {
      topic = `My experience with ${painPoint}`;
    } else {
      topic = `Tips for dealing with ${painPoint}`;
    }

    topics.push({
      topic,
      relevance_score: 0.6,
      post_type: postType,
    });
  }

  return topics;
}

