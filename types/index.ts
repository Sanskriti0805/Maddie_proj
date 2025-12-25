// Core type definitions for Reddit Mastermind

export interface Company {
  id: string;
  name: string;
  description: string | null;
  target_users: string[];
  pain_points: string[];
  tone_positioning: string | null;
  website_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Persona {
  id: string;
  company_id: string;
  name: string;
  tone: string;
  expertise: string[];
  reddit_account: string | null;
  created_at: string;
}

export interface Subreddit {
  id: string;
  company_id: string;
  name: string;
  rules: string | null;
  min_cooldown_days: number;
  max_posts_per_week: number;
  size_category: 'small' | 'medium' | 'large';
  created_at: string;
}

export interface SEOQuery {
  id: string;
  company_id: string;
  query: string;
  priority: number;
  created_at: string;
}

export interface ContentCalendar {
  id: string;
  company_id: string;
  week_start_date: string;
  posts_per_week: number;
  status: 'draft' | 'approved' | 'published';
  created_at: string;
}

export interface CalendarPost {
  id: string;
  calendar_id: string;
  day_of_week: number; // 0=Sunday, 6=Saturday
  subreddit_id: string;
  topic: string;
  persona_id: string;
  post_type: 'question' | 'story' | 'advice';
  planned_title: string | null;
  planned_body: string | null;
  order_in_day: number;
  created_at: string;
}

export interface CalendarReply {
  id: string;
  post_id: string;
  persona_id: string;
  intent: 'ask' | 'challenge' | 'add_value' | 'clarify';
  order_after_post: number; // Hours after post
  planned_content: string | null;
  created_at: string;
}

export interface TopicHistory {
  id: string;
  company_id: string;
  topic: string;
  last_used_date: string | null;
  usage_count: number;
  created_at: string;
}

export interface SubredditActivity {
  id: string;
  subreddit_id: string;
  company_id: string;
  last_post_date: string | null;
  posts_this_week: number;
  week_start_date: string;
  created_at: string;
}

// Extended types for UI
export interface CalendarPostWithDetails extends CalendarPost {
  subreddit?: Subreddit;
  persona?: Persona;
  replies?: CalendarReply[];
}

export interface ContentCalendarWithDetails extends ContentCalendar {
  posts?: CalendarPostWithDetails[];
  company?: Company;
}

// Planning algorithm types
export interface PlanningParams {
  company_id: string;
  week_start_date: Date;
  posts_per_week: number;
  seo_queries?: string[];
  existing_calendar_id?: string; // Optional: use existing calendar instead of creating new one
}

export interface GeneratedTopic {
  topic: string;
  relevance_score: number;
  post_type: 'question' | 'story' | 'advice';
}

export interface SubredditScore {
  subreddit_id: string;
  score: number;
  reasons: string[];
}

export interface PersonaAssignment {
  persona_id: string;
  score: number;
  reasons: string[];
}

export interface ReplyPlan {
  persona_id: string;
  intent: 'ask' | 'challenge' | 'add_value' | 'clarify';
  hours_after_post: number;
}

// Quality evaluation types
export interface CalendarQualityScore {
  overall: number; // 0-10
  topic_diversity: number;
  persona_rotation: number;
  subreddit_distribution: number;
  reply_naturalness: number;
  realism?: number;
  subreddit_fit?: number;
  spam_risk?: number;
  persona_distinctiveness?: number;
  issues: string[];
}

