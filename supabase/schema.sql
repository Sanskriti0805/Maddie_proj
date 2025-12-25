-- Reddit Mastermind Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies table
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  target_users TEXT[],
  pain_points TEXT[],
  tone_positioning TEXT,
  website_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Personas table
CREATE TABLE personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tone TEXT NOT NULL,
  expertise TEXT[],
  reddit_account TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subreddits table
CREATE TABLE subreddits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rules TEXT,
  min_cooldown_days INTEGER DEFAULT 7,
  max_posts_per_week INTEGER DEFAULT 2,
  size_category TEXT CHECK (size_category IN ('small', 'medium', 'large')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

-- SEO Queries table
CREATE TABLE seo_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content Calendars table
CREATE TABLE content_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  posts_per_week INTEGER NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'published')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, week_start_date)
);

-- Calendar Posts table
CREATE TABLE calendar_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID REFERENCES content_calendars(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  subreddit_id UUID REFERENCES subreddits(id),
  topic TEXT NOT NULL,
  persona_id UUID REFERENCES personas(id),
  post_type TEXT NOT NULL CHECK (post_type IN ('question', 'story', 'advice')),
  planned_title TEXT,
  planned_body TEXT,
  order_in_day INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calendar Replies table
CREATE TABLE calendar_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES calendar_posts(id) ON DELETE CASCADE,
  persona_id UUID REFERENCES personas(id),
  intent TEXT NOT NULL CHECK (intent IN ('ask', 'challenge', 'add_value', 'clarify')),
  order_after_post INTEGER NOT NULL, -- Hours after post
  planned_content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Topic History table
CREATE TABLE topic_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  last_used_date DATE,
  usage_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, topic)
);

-- Subreddit Activity table
CREATE TABLE subreddit_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subreddit_id UUID REFERENCES subreddits(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  last_post_date DATE,
  posts_this_week INTEGER DEFAULT 0,
  week_start_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subreddit_id, company_id, week_start_date)
);

-- Indexes for performance
CREATE INDEX idx_personas_company ON personas(company_id);
CREATE INDEX idx_subreddits_company ON subreddits(company_id);
CREATE INDEX idx_calendars_company ON content_calendars(company_id);
CREATE INDEX idx_calendars_week ON content_calendars(week_start_date);
CREATE INDEX idx_posts_calendar ON calendar_posts(calendar_id);
CREATE INDEX idx_posts_subreddit ON calendar_posts(subreddit_id);
CREATE INDEX idx_posts_persona ON calendar_posts(persona_id);
CREATE INDEX idx_replies_post ON calendar_replies(post_id);
CREATE INDEX idx_topic_history_company ON topic_history(company_id);
CREATE INDEX idx_topic_history_date ON topic_history(last_used_date);
CREATE INDEX idx_subreddit_activity_subreddit ON subreddit_activity(subreddit_id);
CREATE INDEX idx_subreddit_activity_company ON subreddit_activity(company_id);
CREATE INDEX idx_subreddit_activity_week ON subreddit_activity(week_start_date);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for companies table
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

