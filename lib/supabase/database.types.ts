// Auto-generated types from Supabase
// Run: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/supabase/database.types.ts
// For now, using manual types based on schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          target_users: string[];
          pain_points: string[];
          tone_positioning: string | null;
          website_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['companies']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['companies']['Insert']>;
      };
      personas: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          tone: string;
          expertise: string[];
          reddit_account: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['personas']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['personas']['Insert']>;
      };
      subreddits: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          rules: string | null;
          min_cooldown_days: number;
          max_posts_per_week: number;
          size_category: 'small' | 'medium' | 'large';
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['subreddits']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['subreddits']['Insert']>;
      };
      content_calendars: {
        Row: {
          id: string;
          company_id: string;
          week_start_date: string;
          posts_per_week: number;
          status: 'draft' | 'approved' | 'published';
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['content_calendars']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['content_calendars']['Insert']>;
      };
      calendar_posts: {
        Row: {
          id: string;
          calendar_id: string;
          day_of_week: number;
          subreddit_id: string;
          topic: string;
          persona_id: string;
          post_type: 'question' | 'story' | 'advice';
          planned_title: string | null;
          planned_body: string | null;
          order_in_day: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['calendar_posts']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['calendar_posts']['Insert']>;
      };
      calendar_replies: {
        Row: {
          id: string;
          post_id: string;
          persona_id: string;
          intent: 'ask' | 'challenge' | 'add_value' | 'clarify';
          order_after_post: number;
          planned_content: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['calendar_replies']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['calendar_replies']['Insert']>;
      };
      topic_history: {
        Row: {
          id: string;
          company_id: string;
          topic: string;
          last_used_date: string | null;
          usage_count: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['topic_history']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['topic_history']['Insert']>;
      };
      subreddit_activity: {
        Row: {
          id: string;
          subreddit_id: string;
          company_id: string;
          last_post_date: string | null;
          posts_this_week: number;
          week_start_date: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['subreddit_activity']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['subreddit_activity']['Insert']>;
      };
      seo_queries: {
        Row: {
          id: string;
          company_id: string;
          query: string;
          priority: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['seo_queries']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['seo_queries']['Insert']>;
      };
    };
  };
}

