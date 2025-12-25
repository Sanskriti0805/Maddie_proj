# Setup Guide

## Prerequisites

1. **Node.js 18+** - [Download](https://nodejs.org/)
2. **Supabase Account** - [Sign up](https://supabase.com/)
3. **OpenAI API Key** - [Get API key](https://platform.openai.com/api-keys)

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set Up Supabase

1. Create a new Supabase project at https://supabase.com
2. Go to SQL Editor
3. Copy and paste the contents of `supabase/schema.sql`
4. Run the SQL to create all tables

## Step 3: Configure Environment Variables

1. Copy `.env.example` to `.env.local`
2. Fill in your Supabase credentials:
   - Go to your Supabase project settings
   - Find "API Settings"
   - Copy `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - Copy `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)
3. Add your OpenAI API key:
   - Get from https://platform.openai.com/api-keys
   - Add to `OPENAI_API_KEY`

## Step 4: Add Initial Data

### Option A: Via Supabase Dashboard

1. Go to Table Editor in Supabase
2. Add a company:
   - `name`: "SlideForge"
   - `description`: "AI-powered presentation tool for founders and marketers"
   - `target_users`: `["founders", "marketers", "startups"]`
   - `pain_points`: `["time-consuming presentations", "design skills", "brand consistency"]`
   - `tone_positioning`: "Helpful and authentic, never salesy"
   - `website_url`: "https://slideforge.ai"

3. Add personas (link to company_id):
   - Persona 1:
     - `name`: "Sarah - Growth Marketer"
     - `tone`: "helpful"
     - `expertise`: `["marketing", "growth", "content"]`
   - Persona 2:
     - `name`: "Alex - Startup Founder"
     - `tone`: "experienced"
     - `expertise`: `["startups", "product", "funding"]`

4. Add subreddits (link to company_id):
   - `name`: "r/startups"
   - `min_cooldown_days`: 7
   - `max_posts_per_week`: 2
   - `size_category`: "large"
   - `rules`: "No self-promotion, be helpful"

### Option B: Via API (after starting server)

```bash
# Start dev server first
npm run dev

# Then use curl or Postman to create company
curl -X POST http://localhost:3000/api/companies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SlideForge",
    "description": "AI-powered presentation tool",
    "target_users": ["founders", "marketers"],
    "pain_points": ["time-consuming presentations"],
    "tone_positioning": "Helpful and authentic"
  }'
```

## Step 5: Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Step 6: Generate Your First Calendar

1. Navigate to Dashboard
2. Click on your company
3. Make sure you have at least:
   - 1+ personas
   - 1+ subreddits
4. Click "Generate Calendar"
5. View the generated calendar with quality scores

## Troubleshooting

### "Missing Supabase environment variables"
- Check that `.env.local` exists and has all required variables
- Restart the dev server after adding env variables

### "Company not found" or "No personas found"
- Make sure you've added data to Supabase
- Check that `company_id` matches in related tables

### Calendar generation fails
- Check OpenAI API key is valid
- Check that you have at least 1 persona and 1 subreddit
- Check browser console for detailed errors

### Database errors
- Verify schema was created correctly
- Check Supabase logs in dashboard
- Ensure all foreign key relationships are correct

## Next Steps

1. **Add More Data**: Add more personas, subreddits, and SEO queries
2. **Generate Multiple Weeks**: Use "Generate Next Week" to create sequential calendars
3. **Review Quality Scores**: Aim for 8+ overall score
4. **Refine Algorithm**: Adjust weights in planning modules based on results

## Production Deployment

1. Deploy to Vercel or similar platform
2. Set environment variables in deployment settings
3. Update Supabase RLS policies if needed
4. Set up monitoring and error tracking

