# Reddit Mastermind – System Design Document

## Overview

Reddit Mastermind is a production-quality content planning engine that automates the creation of organic, high-quality Reddit conversations. The system generates weekly content calendars that feel human, avoid coordination patterns, and drive visibility over time.

**Core Principle**: We are NOT building Reddit bots. We are building a planning and reasoning system that outputs strategic content calendars.

---

## Architecture

### Tech Stack
- **Frontend**: Next.js 14+ (App Router) + React + TypeScript
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **AI Integration**: OpenAI API (for topic generation)
- **Styling**: Tailwind CSS

### System Flow

```
Input (Excel/Manual) 
  ↓
Company Info + Personas + Subreddits + Parameters
  ↓
Planning Algorithm
  ├─ Topic Generation (AI-powered)
  ├─ Subreddit Selection (Heuristic-based)
  ├─ Persona Assignment (Rule-based)
  └─ Conversation Planning (Temporal + Intent-based)
  ↓
Weekly Content Calendar
  ↓
Database Storage + UI Display
  ↓
"Generate Next Week" (with state tracking)
```

---

## Data Models (Supabase Schema)

### 1. `companies`
Stores company information from Excel Sheet #1.

```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  target_users TEXT[], -- Array of user types
  pain_points TEXT[], -- Array of pain points
  tone_positioning TEXT,
  website_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. `personas`
Reddit account personas with distinct tones and expertise.

```sql
CREATE TABLE personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tone TEXT NOT NULL, -- e.g., "helpful", "curious", "experienced"
  expertise TEXT[], -- Array of expertise areas
  reddit_account TEXT, -- Reddit username
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. `subreddits`
Target subreddits with rules and activity tracking.

```sql
CREATE TABLE subreddits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL UNIQUE, -- e.g., "r/startups"
  rules TEXT, -- Subreddit rules as text
  min_cooldown_days INTEGER DEFAULT 7, -- Minimum days between posts
  max_posts_per_week INTEGER DEFAULT 2,
  size_category TEXT, -- "small", "medium", "large"
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. `content_calendars`
Weekly content calendars.

```sql
CREATE TABLE content_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  posts_per_week INTEGER NOT NULL,
  status TEXT DEFAULT 'draft', -- 'draft', 'approved', 'published'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, week_start_date)
);
```

### 5. `calendar_posts`
Individual posts in a calendar.

```sql
CREATE TABLE calendar_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID REFERENCES content_calendars(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL, -- 0=Sunday, 6=Saturday
  subreddit_id UUID REFERENCES subreddits(id),
  topic TEXT NOT NULL,
  persona_id UUID REFERENCES personas(id),
  post_type TEXT NOT NULL, -- 'question', 'story', 'advice'
  planned_title TEXT,
  planned_body TEXT,
  order_in_day INTEGER DEFAULT 0, -- For multiple posts same day
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6. `calendar_replies`
Planned replies to posts.

```sql
CREATE TABLE calendar_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES calendar_posts(id) ON DELETE CASCADE,
  persona_id UUID REFERENCES personas(id),
  intent TEXT NOT NULL, -- 'ask', 'challenge', 'add_value', 'clarify'
  order_after_post INTEGER NOT NULL, -- Hours/days after post
  planned_content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7. `topic_history`
Tracks topic usage to prevent repetition.

```sql
CREATE TABLE topic_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  last_used_date DATE,
  usage_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 8. `subreddit_activity`
Tracks posting frequency per subreddit.

```sql
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
```

### 9. `seo_queries`
ChatGPT/SEO queries to target.

```sql
CREATE TABLE seo_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Algorithm Design

### 1. Topic Generation Logic

**Inputs:**
- Company description, pain points, target users
- SEO queries
- Topic history (to avoid repetition)

**Process:**
1. Extract key themes from company info
2. Use OpenAI to generate 20-30 topic variations
3. Filter for:
   - Non-salesy tone
   - Natural Reddit fit
   - Relevance to target users
4. Check against `topic_history` (avoid topics used in last 4 weeks)
5. Rank by freshness and relevance

**Output:** Array of unique topics

**Why:** Ensures variety, relevance, and natural fit while avoiding repetition.

---

### 2. Subreddit Selection Heuristics

**Rules:**
1. **Relevance Match**: Topic must naturally fit subreddit theme
2. **Cooldown Check**: `last_post_date + min_cooldown_days <= target_date`
3. **Frequency Limit**: `posts_this_week < max_posts_per_week`
4. **Size Consideration**: 
   - Small subreddits: 1 post/week max
   - Medium: 2 posts/week max
   - Large: 3 posts/week max
5. **Rule Compliance**: Check if post type is allowed

**Scoring:**
```
score = relevance_score * 0.4 
      + cooldown_available * 0.3
      + frequency_available * 0.2
      + size_appropriateness * 0.1
```

**Why:** Prevents overposting, respects community norms, maintains natural distribution.

---

### 3. Persona Assignment Rules

**Rules:**
1. **Expertise Match**: Assign topics to personas whose expertise aligns
2. **Tone Consistency**: Match post type to persona tone
   - "helpful" → advice posts
   - "curious" → question posts
   - "experienced" → story posts
3. **Natural Rotation**: Distribute posts evenly (within 20% variance)
4. **Avoid Collisions**: Same persona doesn't post in same subreddit within 3 days

**Assignment Algorithm:**
```
For each post:
  1. Filter personas by expertise match
  2. Filter by tone compatibility
  3. Filter by recent activity (cooldown)
  4. Select persona with lowest recent post count
  5. Break ties randomly
```

**Why:** Creates natural persona diversity, prevents obvious patterns, maintains authenticity.

---

### 4. Conversation Planning Logic

**Reply Strategy:**
1. **Not Every Post Gets Replies**: 60-70% of posts get planned replies (natural variance)
2. **Reply Timing**: 
   - "ask" intent: 2-4 hours after post
   - "challenge": 6-12 hours
   - "add_value": 4-8 hours
   - "clarify": 1-3 hours
3. **Persona Constraints**:
   - Never reply to own post
   - Never have 2 personas reply to same post (looks coordinated)
   - Maximum 1 reply per post
4. **Intent Distribution**: Mix of intents across calendar

**Why:** Mimics organic engagement patterns, avoids coordination signals, adds value naturally.

---

### 5. Weekly State Tracking

**On Calendar Generation:**
1. Update `topic_history` for all used topics
2. Update `subreddit_activity` for all subreddits
3. Track persona posting frequency
4. Store calendar with status='draft'

**On "Generate Next Week":**
1. Load previous week's state
2. Check cooldowns
3. Check topic freshness
4. Rotate personas (avoid same patterns)
5. Build on past discussions (reference previous topics naturally)

**Why:** Maintains continuity, prevents repetition, respects constraints across weeks.

---

## Edge Cases & Safety

### 1. Overposting Prevention
- **Check**: `subreddit_activity.posts_this_week < max_posts_per_week`
- **Action**: Skip subreddit if limit reached
- **Fallback**: Suggest alternative subreddits

### 2. Topic Repetition
- **Check**: `topic_history.last_used_date > 4 weeks ago`
- **Action**: Filter out recent topics
- **Fallback**: Generate new topic variations

### 3. Persona Collisions
- **Check**: Same persona in same subreddit within 3 days
- **Action**: Reassign to different persona
- **Fallback**: Delay post to next week

### 4. Self-Reply Prevention
- **Check**: Reply persona != Post persona
- **Action**: Skip reply or reassign
- **Fallback**: Remove reply from plan

### 5. Small Subreddit Handling
- **Check**: `size_category == 'small'`
- **Action**: Max 1 post/week, longer cooldowns
- **Fallback**: Prioritize larger subreddits

### 6. Strict Subreddit Rules
- **Check**: Parse rules for keywords (e.g., "no self-promotion")
- **Action**: Filter post types accordingly
- **Fallback**: Skip subreddit if incompatible

---

## Testing Strategy

### Quality Evaluation Criteria

**3/10 Calendar:**
- Obvious topic repetition
- Same persona posting multiple days in a row
- Replies look coordinated (same timing, same personas)
- Overposting in subreddits
- Salesy language

**9/10 Calendar:**
- Diverse topics with natural variation
- Personas rotate naturally
- Replies have varied timing and intents
- Subreddit distribution feels organic
- Language matches community norms
- No obvious patterns

### Test Scenarios

1. **Different Companies**: Test with B2B SaaS, e-commerce, consulting
2. **Persona Mixes**: 2 personas vs 5 personas
3. **Subreddit Mixes**: Small vs large, strict vs lenient
4. **Frequency Tests**: 3 posts/week vs 10 posts/week
5. **Multi-Week**: Generate 4 weeks, check for patterns

---

## Production Readiness

### Metrics to Track

1. **Calendar Quality Score** (automated)
   - Topic diversity
   - Persona rotation variance
   - Subreddit distribution
   - Reply naturalness

2. **Engagement Metrics** (post-generation)
   - Post upvotes
   - Comment engagement
   - Click-through rates
   - Lead generation

3. **System Metrics**
   - Calendar generation time
   - API response times
   - Error rates
   - Database query performance

### Improvement Loop

1. **Weekly Review**: Analyze calendar quality scores
2. **A/B Testing**: Test different persona assignments, timing strategies
3. **Feedback Integration**: Learn from actual Reddit performance
4. **Algorithm Refinement**: Update heuristics based on data

### Scaling to Many Clients

1. **Multi-tenancy**: `company_id` in all tables
2. **Rate Limiting**: Per-company API limits
3. **Caching**: Cache topic generation, subreddit rules
4. **Queue System**: Background job processing for calendar generation
5. **Resource Isolation**: Separate database indexes per company

---

## Implementation Plan (3 Days)

### Day 1: Database & Backend Foundation
- [ ] Set up Supabase project
- [ ] Create all database tables
- [ ] Set up Next.js project with TypeScript
- [ ] Configure Supabase client
- [ ] Create API routes for CRUD operations
- [ ] Implement basic company/persona/subreddit management

### Day 2: Planning Algorithm
- [ ] Implement topic generation (OpenAI integration)
- [ ] Build subreddit selection heuristics
- [ ] Create persona assignment logic
- [ ] Design conversation planning algorithm
- [ ] Implement weekly state tracking
- [ ] Add edge case handlers

### Day 3: Frontend & Integration
- [ ] Build dashboard UI
- [ ] Create calendar view component
- [ ] Implement company/persona/subreddit management UI
- [ ] Add "Generate Next Week" functionality
- [ ] Create quality evaluation display
- [ ] Add testing utilities

---

## Next Steps

1. Review and approve system design
2. Set up Supabase project
3. Initialize Next.js project
4. Begin Day 1 implementation

