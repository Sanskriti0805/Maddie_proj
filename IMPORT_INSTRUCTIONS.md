# How to Import Your Excel File

## Quick Import (One Step)

Your Excel file has two sheets:
1. **Company Info** - Company details, Personas, SEO Queries
2. **Content Calendar** - Posts and Comments

Import everything in one go:

### Step 1: Start the Server

```powershell
npm run dev
```

### Step 2: Import Your Excel File

**Option A: Using Web Interface (Easiest - Recommended)**

1. Make sure server is running: `npm run dev`
2. Open in browser: http://localhost:3000/import
3. Click "Choose File" and select your Excel file
4. Click "Import File"
5. Wait for success message!

**Option B: Using Node.js Script**

First install dependencies:
```powershell
npm install form-data node-fetch@2
```

Then run:
```powershell
node import.js "C:\Users\Sanskriti\projects\SlideForge.xlsx"
```

**Option C: Using PowerShell Script**

```powershell
.\import-excel.ps1 "C:\Users\Sanskriti\projects\SlideForge.xlsx"
```

**Option D: Using Postman/Insomnia (Easiest)**

```powershell
$filePath = "C:\Users\Sanskriti\projects\SlideForge.xlsx"
$uri = "http://localhost:3000/api/import/unified"

# Create multipart form data
$fileBytes = [System.IO.File]::ReadAllBytes($filePath)
$fileName = [System.IO.Path]::GetFileName($filePath)
$boundary = [System.Guid]::NewGuid().ToString()
$LF = "`r`n"

$bodyLines = @(
    "--$boundary",
    "Content-Disposition: form-data; name=`"file`"; filename=`"$fileName`"",
    "Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "",
    [System.Text.Encoding]::GetEncoding("iso-8859-1").GetString($fileBytes),
    "--$boundary--"
) -join $LF

**Option B: Using curl.exe (if you have it)**

```powershell
$filePath = "C:\Users\Sanskriti\projects\SlideForge.xlsx"
curl.exe -X POST "http://localhost:3000/api/import/unified" -F "file=@$filePath"
```

**Option C: Using Postman/Insomnia (Easiest)**

1. Open Postman or Insomnia
2. Create new request:
   - Method: `POST`
   - URL: `http://localhost:3000/api/import/unified`
   - Body: Select `form-data`
   - Add field:
     - Key: `file` (type: File)
     - Value: Click "Select Files" and choose your Excel file
3. Click "Send"

### Step 3: Verify Import

1. Go to: http://localhost:3000/dashboard
2. You should see your company "Slideforge"
3. Click on it to see:
   - ✅ Personas (riley_ops, jordan_consults, etc.)
   - ✅ Subreddits (r/PowerPoint, etc.)
   - ✅ Calendar with posts and comments

## What Gets Imported

✅ **Company** - Name, website, description  
✅ **Personas** - All usernames with inferred tone and expertise  
✅ **Subreddits** - From company info section  
✅ **SEO Queries** - All ChatGPT queries (K1-K13)  
✅ **Calendar** - Posts (P1, P2, P3) and Comments (C1-C9)  
✅ **Replies** - Comments linked to posts automatically  

## Troubleshooting

### "Cannot bind parameter 'Form'"
- Make sure you're using PowerShell 6+ or use Option B/C instead

### "File not found"
- Check the file path is correct
- Use full path: `C:\Users\Sanskriti\projects\SlideForge.xlsx`

### "Connection refused"
- Make sure server is running: `npm run dev`
- Check it's running on port 3000

## That's It!

No need to manually add anything. Just import your Excel file and everything is set up! 🎉
