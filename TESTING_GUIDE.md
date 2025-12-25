# Testing Guide

## Quick Test Checklist

### ✅ 1. Import Test (Already Done!)
- [x] Excel file imported successfully
- [x] Company, personas, subreddits, and calendar data imported

### 2. View Imported Data

**Test the Dashboard:**
1. Open: http://localhost:3000/dashboard
2. You should see:
   - Your imported company (Slideforge)
   - List of companies
   - Ability to view company details

**Test Company Details:**
1. Click on a company from the dashboard
2. Should show:
   - Company information
   - Associated personas
   - Subreddits
   - Content calendars

### 3. Test API Endpoints Directly

**Get All Companies:**
```bash
# In PowerShell or browser
curl http://localhost:3000/api/companies
```

**Get Specific Company:**
```bash
# Replace {id} with actual company ID from dashboard
curl http://localhost:3000/api/companies/{id}
```

**Get Personas:**
```bash
curl http://localhost:3000/api/personas
```

**Get Subreddits:**
```bash
curl http://localhost:3000/api/subreddits
```

**Get Calendars:**
```bash
curl http://localhost:3000/api/calendars
```

### 4. Test Calendar Generation

**Generate a New Calendar:**
1. Go to: http://localhost:3000/dashboard
2. Find your company
3. Use the generate calendar feature (if available in UI)
   
**Or use API directly:**
```bash
# POST request to generate calendar
# Replace {companyId} with actual ID
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"companyId": "{companyId}", "weekStart": "2024-01-01"}'
```

### 5. Test Import Page

**Re-import Excel (if needed):**
1. Go to: http://localhost:3000/import
2. Upload your Excel file again
3. Should show success message

### 6. View Calendar Details

**View a Specific Calendar:**
1. Go to: http://localhost:3000/dashboard/calendars/{calendarId}
2. Should show:
   - Calendar posts
   - Planned replies
   - Schedule for the week

## Manual Testing Steps

### Step 1: Verify Data Import
1. Open http://localhost:3000/dashboard
2. Check if you see "Slideforge" company
3. Click on it to see details

### Step 2: Check Database (via Supabase Dashboard)
1. Go to your Supabase project dashboard
2. Open Table Editor
3. Verify data in:
   - `companies` table
   - `personas` table
   - `subreddits` table
   - `content_calendars` table
   - `calendar_posts` table
   - `calendar_replies` table

### Step 3: Test Calendar View
1. Navigate to a calendar from the dashboard
2. Verify posts are displayed correctly
3. Check that replies are linked to posts

### Step 4: Test Calendar Generation (if implemented)
1. Try generating a new calendar for next week
2. Verify it creates posts and replies
3. Check that it respects subreddit cooldowns

## Browser Console Testing

Open browser DevTools (F12) and check:
- No console errors
- Network requests succeed (200 status)
- Data loads correctly

## Common Issues to Check

1. **404 Errors**: Check if routes exist
2. **500 Errors**: Check server console for errors
3. **Empty Data**: Verify Supabase connection
4. **Type Errors**: Check TypeScript compilation

## Next Steps After Testing

Once everything works:
1. Generate new calendars
2. Customize personas and subreddits
3. Test the planning algorithm
4. Export calendars if needed

