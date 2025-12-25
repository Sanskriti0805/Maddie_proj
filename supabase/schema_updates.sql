-- Schema updates for enhanced Reddit content planning system
-- Run these ALTER TABLE statements in your Supabase SQL Editor

-- Add posting strategy to calendar_posts
ALTER TABLE calendar_posts 
ADD COLUMN IF NOT EXISTS posting_strategy TEXT CHECK (posting_strategy IN ('awareness', 'authority', 'subtle_product', 'value', 'engagement'));

-- Add subreddit tone/culture info
ALTER TABLE subreddits
ADD COLUMN IF NOT EXISTS culture_tone TEXT DEFAULT 'casual',
ADD COLUMN IF NOT EXISTS preferred_post_types TEXT[] DEFAULT ARRAY['question', 'story', 'advice'];

-- Add quality scores to content_calendars
ALTER TABLE content_calendars
ADD COLUMN IF NOT EXISTS quality_score JSONB,
ADD COLUMN IF NOT EXISTS quality_feedback TEXT[];

-- Add spam risk warnings
ALTER TABLE content_calendars
ADD COLUMN IF NOT EXISTS spam_warnings JSONB;

-- Add reply tone and emotion
ALTER TABLE calendar_replies
ADD COLUMN IF NOT EXISTS tone TEXT DEFAULT 'helpful',
ADD COLUMN IF NOT EXISTS emotion TEXT CHECK (emotion IN ('curious', 'supportive', 'skeptical', 'excited', 'neutral'));

-- Add topic similarity tracking
CREATE TABLE IF NOT EXISTS topic_similarity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  topic1 TEXT NOT NULL,
  topic2 TEXT NOT NULL,
  similarity_score NUMERIC(3,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, topic1, topic2)
);

-- Add wording patterns tracking for spam detection
CREATE TABLE IF NOT EXISTS wording_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  usage_count INTEGER DEFAULT 1,
  last_used_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_topic_similarity_company ON topic_similarity(company_id);
CREATE INDEX IF NOT EXISTS idx_wording_patterns_company ON wording_patterns(company_id);

