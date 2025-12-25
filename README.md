# Reddit Mastermind – Content Planning Engine

A production-quality system for automating Reddit content planning that generates organic, high-quality conversation calendars.

## 🎯 Core Principle

**We are NOT building Reddit bots.** We are building a planning and reasoning system that outputs strategic content calendars for human execution.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Supabase account
- OpenAI API key

### Setup

1. **Install dependencies**
```bash
npm install
```

2. **Environment variables**
Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_key
```

3. **Database setup**
Run the SQL schema from `supabase/schema.sql` in your Supabase SQL editor.

4. **Run development server**
```bash
npm run dev
```

## 📁 Project Structure

```
├── app/
│   ├── api/              # Next.js API routes
│   │   ├── companies/
│   │   ├── personas/
│   │   ├── subreddits/
│   │   ├── calendars/
│   │   └── generate/
│   ├── (dashboard)/      # Dashboard pages
│   │   ├── page.tsx      # Main dashboard
│   │   ├── companies/
│   │   ├── calendars/
│   │   └── settings/
│   └── layout.tsx
├── lib/
│   ├── supabase/         # Supabase client
│   ├── planning/          # Planning algorithm
│   │   ├── topics.ts
│   │   ├── subreddits.ts
│   │   ├── personas.ts
│   │   └── conversations.ts
│   └── utils/
├── components/           # React components
│   ├── Calendar/
│   ├── Company/
│   ├── Persona/
│   └── UI/
├── types/                # TypeScript types
└── supabase/
    └── schema.sql        # Database schema
```

## 🔧 Key Features

- **AI-Powered Topic Generation**: Uses OpenAI to generate relevant, non-salesy topics
- **Smart Subreddit Selection**: Heuristic-based selection with cooldown and frequency tracking
- **Persona Management**: Multiple Reddit personas with distinct tones and expertise
- **Conversation Planning**: Natural reply timing and intent distribution
- **State Tracking**: Prevents repetition, respects cooldowns, maintains continuity
- **Quality Evaluation**: Automated scoring for calendar quality

## 📊 Database Schema

See `SYSTEM_DESIGN.md` for complete schema documentation.

Key tables:
- `companies` - Company information
- `personas` - Reddit account personas
- `subreddits` - Target subreddits with rules
- `content_calendars` - Weekly calendars
- `calendar_posts` - Individual posts
- `calendar_replies` - Planned replies
- `topic_history` - Topic usage tracking
- `subreddit_activity` - Posting frequency tracking

## 🧠 Planning Algorithm

The system uses a multi-stage algorithm:

1. **Topic Generation**: AI-powered topic creation with repetition prevention
2. **Subreddit Selection**: Relevance + cooldown + frequency heuristics
3. **Persona Assignment**: Expertise matching + natural rotation
4. **Conversation Planning**: Temporal reply distribution with intent variety

See `SYSTEM_DESIGN.md` for detailed algorithm documentation.

## 🛡️ Edge Cases Handled

- Overposting prevention
- Topic repetition avoidance
- Persona collision detection
- Self-reply prevention
- Small subreddit handling
- Strict subreddit rule compliance

## 📈 Production Readiness

- Multi-tenant architecture
- Quality metrics tracking
- Performance optimization
- Error handling
- Scalability considerations

## 📝 License

Private - Production use only

