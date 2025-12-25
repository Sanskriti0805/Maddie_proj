# Database Migration Required

## Issue
The database schema is missing the new columns needed for enhanced features:
- `posting_strategy` in `calendar_posts`
- `tone` and `emotion` in `calendar_replies`
- `quality_score`, `quality_feedback`, and `spam_warnings` in `content_calendars`

## Solution

### Step 1: Open Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** (in the left sidebar)

### Step 2: Run the Migration
1. Open the file: `supabase/migrations/001_add_enhanced_features.sql`
2. Copy the entire contents
3. Paste it into the Supabase SQL Editor
4. Click **Run** (or press Ctrl+Enter)

### Step 3: Verify
After running, you should see a success message. The migration uses `IF NOT EXISTS` so it's safe to run multiple times.

### Alternative: Run via Supabase CLI
If you have Supabase CLI installed:
```bash
cd Maddie_proj
supabase db push
```

## What This Migration Does
- Adds `posting_strategy` column to `calendar_posts` table
- Adds `tone` and `emotion` columns to `calendar_replies` table
- Adds `quality_score`, `quality_feedback`, and `spam_warnings` to `content_calendars` table
- Expands `post_type` and `intent` check constraints to include more options
- Creates optional tables for topic similarity and wording patterns tracking

## After Migration
Once the migration is complete:
1. Refresh your browser
2. Try editing a post again - the error should be gone
3. All new features should work correctly

