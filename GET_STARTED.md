# 🚀 Get Started - Step by Step

## Current Status: ✅ Dependencies Installed

You've completed:
- ✅ Project structure created
- ✅ Dependencies installed
- ✅ Environment file template created

## Next: Configure Your Environment

### Step 1: Fill in `.env.local`

Open `.env.local` in your editor and replace the placeholder values:

```env
# You need to get these from Supabase (see Step 2)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# You need to get this from OpenAI (see Step 3)
OPENAI_API_KEY=sk-your-openai-key-here
```

---

## Step 2: Set Up Supabase (5 minutes)

### 2.1 Create Project
1. Go to **https://supabase.com**
2. Click **"Start your project"** or **"New Project"**
3. Fill in:
   - **Name**: `Reddit Mastermind` (or your choice)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to you
4. Click **"Create new project"**
5. ⏳ Wait 2-3 minutes for setup

### 2.2 Get API Keys
1. In your project dashboard, click **⚙️ Settings** (bottom left)
2. Click **API** in the sidebar
3. You'll see:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** key (long string)
   - **service_role** key (long string) ⚠️ **Keep this secret!**

4. Copy these into `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
   ```

### 2.3 Create Database Tables
1. In Supabase, click **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Open `supabase/schema.sql` from this project folder
4. **Select ALL** the SQL code (Ctrl+A)
5. **Copy** it (Ctrl+C)
6. **Paste** into Supabase SQL Editor
7. Click **"Run"** button (or press Ctrl+Enter)
8. ✅ You should see: **"Success. No rows returned"**

---

## Step 3: Get OpenAI API Key (2 minutes)

1. Go to **https://platform.openai.com/api-keys**
2. Sign up or log in
3. Click **"Create new secret key"**
4. Give it a name: `Reddit Mastermind`
5. Click **"Create secret key"**
6. ⚠️ **Copy the key immediately** (starts with `sk-`)
   - You won't see it again!
7. Paste into `.env.local`:
   ```
   OPENAI_API_KEY=sk-proj-xxxxx...
   ```

---

## Step 4: Import Your Excel File (2 minutes)

### Quick Import (Recommended)

If you have an Excel file with Company Info and Content Calendar sheets:

**One-step import** - Imports company, personas, subreddits, SEO queries, and calendar all at once:

1. **Start the server** (if not running):
   ```powershell
   npm run dev
   ```

2. **Import your Excel file**:
   ```powershell
   $filePath = "C:\path\to\your\SlideForge.xlsx"
   curl -X POST "http://localhost:3000/api/import/unified" -F "file=@$filePath"
   ```

   Or use Postman/Insomnia:
   - POST to: `http://localhost:3000/api/import/unified`
   - Body: `form-data`
   - Key: `file` (type: File)
   - Select your Excel file
   - Send

3. **Verify import**:
   - Go to Dashboard: http://localhost:3000/dashboard
   - Your company should appear
   - Click on it to see personas, subreddits, and calendar

**See `IMPORT_INSTRUCTIONS.md` for detailed steps.**

### Option B: Manual Entry via Supabase Dashboard

1. In Supabase, click **Table Editor** (left sidebar)

2. **Create Company:**
   - Click `companies` table
   - Click **"Insert"** → **"Insert row"**
   - Fill in:
     ```
     name: SlideForge
     description: AI-powered presentation tool for founders and marketers
     target_users: ["founders", "marketers", "startups"]
     pain_points: ["time-consuming presentations", "design skills", "brand consistency"]
     tone_positioning: Helpful and authentic, never salesy
     website_url: https://slideforge.ai
     ```
   - Click **"Save"**
   - **📋 Copy the `id`** (UUID) - you'll need it for next steps!

3. **Create Persona 1:**
   - Click `personas` table
   - Click **"Insert"** → **"Insert row"**
   - Fill in:
     ```
     company_id: [paste the UUID from step 2]
     name: Sarah - Growth Marketer
     tone: helpful
     expertise: ["marketing", "growth", "content"]
     reddit_account: (leave empty)
     ```
   - Click **"Save"**

4. **Create Persona 2:**
   - Click **"Insert"** → **"Insert row"** again
   - Fill in:
     ```
     company_id: [same UUID]
     name: Alex - Startup Founder
     tone: experienced
     expertise: ["startups", "product", "funding"]
     ```
   - Click **"Save"**

5. **Create Subreddit 1:**
   - Click `subreddits` table
   - Click **"Insert"** → **"Insert row"**
   - Fill in:
     ```
     company_id: [same UUID]
     name: r/startups
     min_cooldown_days: 7
     max_posts_per_week: 2
     size_category: large
     rules: No self-promotion, be helpful and authentic
     ```
   - Click **"Save"**

6. **Create Subreddit 2:**
   - Click **"Insert"** → **"Insert row"** again
   - Fill in:
     ```
     company_id: [same UUID]
     name: r/entrepreneur
     min_cooldown_days: 5
     max_posts_per_week: 2
     size_category: large
     rules: Focus on value, no direct promotion
     ```
   - Click **"Save"**

---

## Step 5: Start the App! 🎉

1. **Start the dev server:**
   ```powershell
   npm run dev
   ```

2. **Open your browser:**
   - Go to **http://localhost:3000**

3. **Navigate to Dashboard:**
   - Click **"Dashboard"** button
   - You should see your company listed!

4. **View Company:**
   - Click on your company name
   - Verify you see:
     - ✅ Company info
     - ✅ 2 Personas
     - ✅ 2 Subreddits

5. **Generate Your First Calendar:**
   - Click **"Generate Calendar"** button
   - ⏳ Wait 10-30 seconds (OpenAI API call)
   - 🎉 **View your generated calendar!**

---

## ✅ Success Checklist

You're all set when:
- [ ] `.env.local` has all 4 values filled in
- [ ] Supabase project created
- [ ] Database tables created (schema.sql run)
- [ ] Company added to database
- [ ] At least 2 personas added
- [ ] At least 2 subreddits added
- [ ] Dev server runs: `npm run dev`
- [ ] Dashboard shows your company
- [ ] "Generate Calendar" works
- [ ] Calendar displays with quality score

---

## 🐛 Common Issues

### "Missing Supabase environment variables"
- **Fix**: Check `.env.local` has all 3 Supabase values
- **Fix**: Restart dev server after editing `.env.local`

### "Company not found"
- **Fix**: Verify you added company in Supabase Table Editor
- **Fix**: Check company_id matches in personas/subreddits tables

### "Failed to generate calendar"
- **Fix**: Check OpenAI API key is valid and has credits
- **Fix**: Verify you have at least 1 persona and 1 subreddit
- **Fix**: Check browser console for detailed errors

### Database errors
- **Fix**: Re-run `schema.sql` in Supabase SQL Editor
- **Fix**: Check Supabase logs in dashboard

---

## 📚 Need More Help?

- **Detailed Setup**: See `SETUP.md`
- **Quick Reference**: See `QUICK_START.md`
- **Step-by-Step Checklist**: See `SETUP_CHECKLIST.md`
- **Architecture**: See `SYSTEM_DESIGN.md`

---

**Ready?** Start with Step 2 above! 🚀

