# Quick Start Guide

## 🚀 Get Running in 5 Minutes

### 1. Install & Configure (2 min)

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your keys:
# - Supabase URL & keys (from Supabase dashboard)
# - OpenAI API key
```

### 2. Set Up Database (2 min)

1. Go to Supabase SQL Editor
2. Copy/paste `supabase/schema.sql`
3. Run it

### 3. Add Test Data (1 min)

Via Supabase Table Editor, add:

**Company:**
```json
{
  "name": "SlideForge",
  "description": "AI-powered presentation tool",
  "target_users": ["founders", "marketers"],
  "pain_points": ["time-consuming presentations"],
  "tone_positioning": "Helpful and authentic"
}
```

**Persona:**
```json
{
  "company_id": "<company_id_from_above>",
  "name": "Sarah - Growth Marketer",
  "tone": "helpful",
  "expertise": ["marketing", "growth"]
}
```

**Subreddit:**
```json
{
  "company_id": "<company_id_from_above>",
  "name": "r/startups",
  "min_cooldown_days": 7,
  "max_posts_per_week": 2,
  "size_category": "large"
}
```

### 4. Generate Calendar

```bash
npm run dev
```

1. Open http://localhost:3000
2. Go to Dashboard
3. Click your company
4. Click "Generate Calendar"
5. View your weekly content plan!

## 📚 Key Files

- **Planning Algorithm**: `lib/planning/`
- **API Routes**: `app/api/`
- **Frontend**: `app/dashboard/`
- **Database Schema**: `supabase/schema.sql`

## 🎯 What It Does

1. **Generates Topics**: AI-powered, non-salesy Reddit topics
2. **Selects Subreddits**: Based on relevance, cooldowns, rules
3. **Assigns Personas**: Matches expertise and tone
4. **Plans Replies**: Natural conversation flow
5. **Scores Quality**: 0-10 quality evaluation

## 🔍 Quality Score Breakdown

- **8-10**: Excellent, ready for production
- **6-7**: Good, minor tweaks needed
- **4-5**: Needs improvement (check issues list)
- **0-3**: Regenerate with different parameters

## 💡 Tips

1. **More Personas = Better Rotation**: Aim for 2-4 personas
2. **Diverse Subreddits**: Mix small/medium/large
3. **Review Quality Issues**: Fix flagged problems
4. **Iterate**: Regenerate to improve scores

## 🐛 Troubleshooting

**"Missing environment variables"**
→ Check `.env.local` exists and has all keys

**"No personas/subreddits found"**
→ Add data via Supabase dashboard or API

**"Calendar generation fails"**
→ Check OpenAI API key is valid
→ Check browser console for errors

**"Low quality score"**
→ Add more personas
→ Add more subreddits
→ Check quality issues list

## 📖 Full Documentation

- **Setup Guide**: `SETUP.md`
- **System Design**: `SYSTEM_DESIGN.md`
- **Implementation Details**: `IMPLEMENTATION_SUMMARY.md`

---

**Ready to generate your first calendar?** 🎉

