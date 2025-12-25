/**
 * Posting Strategy Module
 * Implements strategic progression: awareness → authority → subtle product → value → engagement
 */

export type PostingStrategy = 'awareness' | 'authority' | 'subtle_product' | 'value' | 'engagement';

export interface StrategyAssignment {
  strategy: PostingStrategy;
  dayOfWeek: number;
  rationale: string;
}

/**
 * Assigns posting strategy to each day of the week
 * Creates a natural progression throughout the week
 */
export function assignWeeklyStrategy(
  postsPerWeek: number,
  dayDistribution: number[]
): Map<number, PostingStrategy[]> {
  const strategyMap = new Map<number, PostingStrategy[]>();
  
  // Define strategy progression for the week
  const strategyProgression: PostingStrategy[] = [
    'awareness',      // Early week: Build awareness
    'authority',      // Mid-early: Establish authority
    'subtle_product', // Mid-week: Subtle product mention
    'value',          // Mid-late: Provide value
    'engagement',     // Late week: Drive engagement
  ];

  // Distribute strategies across days with posts
  let strategyIndex = 0;
  
  for (let day = 0; day < 7; day++) {
    const postsForDay = dayDistribution[day];
    if (postsForDay === 0) continue;

    const dayStrategies: PostingStrategy[] = [];
    
    // Assign primary strategy for the day
    const primaryStrategy = strategyProgression[strategyIndex % strategyProgression.length];
    
    // For days with multiple posts, mix strategies
    for (let i = 0; i < postsForDay; i++) {
      if (i === 0) {
        // First post gets primary strategy
        dayStrategies.push(primaryStrategy);
      } else {
        // Additional posts get complementary strategies
        const complementary = getComplementaryStrategy(primaryStrategy);
        dayStrategies.push(complementary);
      }
    }
    
    strategyMap.set(day, dayStrategies);
    strategyIndex++;
  }

  return strategyMap;
}

/**
 * Gets complementary strategy that works well together
 */
function getComplementaryStrategy(primary: PostingStrategy): PostingStrategy {
  const complementaryMap: Record<PostingStrategy, PostingStrategy[]> = {
    awareness: ['value', 'engagement'],
    authority: ['value', 'awareness'],
    subtle_product: ['value', 'authority'],
    value: ['engagement', 'awareness'],
    engagement: ['value', 'authority'],
  };

  const options = complementaryMap[primary] || ['value'];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Determines post type and content style based on strategy
 */
export function getPostTypeForStrategy(strategy: PostingStrategy): {
  preferredTypes: Array<'question' | 'story' | 'advice'>;
  contentStyle: string;
} {
  const strategyMap: Record<PostingStrategy, {
    preferredTypes: Array<'question' | 'story' | 'advice'>;
    contentStyle: string;
  }> = {
    awareness: {
      preferredTypes: ['question', 'story'],
      contentStyle: 'Educational, introduces problem space',
    },
    authority: {
      preferredTypes: ['advice', 'story'],
      contentStyle: 'Expert insights, demonstrates knowledge',
    },
    subtle_product: {
      preferredTypes: ['story', 'advice'],
      contentStyle: 'Natural mention, not salesy',
    },
    value: {
      preferredTypes: ['advice', 'question'],
      contentStyle: 'Helpful, actionable, solves problems',
    },
    engagement: {
      preferredTypes: ['question', 'story'],
      contentStyle: 'Conversational, invites discussion',
    },
  };

  return strategyMap[strategy];
}

/**
 * Generates rationale for strategy assignment
 */
export function getStrategyRationale(
  strategy: PostingStrategy,
  dayOfWeek: number,
  companyName: string
): string {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[dayOfWeek];

  const rationales: Record<PostingStrategy, string> = {
    awareness: `Build awareness in the ${dayName} slot to introduce ${companyName} to the community naturally`,
    authority: `Establish authority on ${dayName} by sharing expert insights`,
    subtle_product: `Subtle product mention on ${dayName} - natural integration without being salesy`,
    value: `Provide value on ${dayName} to help community members solve problems`,
    engagement: `Drive engagement on ${dayName} with discussion-worthy content`,
  };

  return rationales[strategy];
}

