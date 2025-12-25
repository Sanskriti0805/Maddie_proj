# Supabase Setup Guide

## Quick Setup Steps

1. **Go to [supabase.com](https://supabase.com)** and sign up/login

2. **Create a new project** (or use an existing one)

3. **Get your credentials:**
   - Go to **Settings** → **API**
   - Copy these values:
     - **Project URL** (looks like: `https://xxxxx.supabase.co`)
     - **anon/public key** (long string starting with `eyJ...`)
     - **service_role key** (long string starting with `eyJ...`) - ⚠️ Keep this secret!

4. **Update your `.env.local` file** in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-actual-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

5. **Run the database schema:**
   - Go to **SQL Editor** in Supabase dashboard
   - Copy the contents of `supabase/schema.sql`
   - Paste and run it

6. **Restart your dev server:**
   ```bash
   # Stop the current server (Ctrl+C)
   npm run dev
   ```

## Where to Find Your Keys

1. **Project URL**: Settings → API → Project URL
2. **anon key**: Settings → API → Project API keys → `anon` `public`
3. **service_role key**: Settings → API → Project API keys → `service_role` `secret` ⚠️

## Important Notes

- The `service_role` key has admin access - **never commit it to git**
- The `.env.local` file is already in `.gitignore` - it won't be committed
- After updating `.env.local`, you **must restart** the dev server for changes to take effect

