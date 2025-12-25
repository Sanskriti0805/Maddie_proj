import { parse, getDay, startOfWeek } from 'date-fns';

// Import xlsx - use require for Next.js compatibility
const XLSX = require('xlsx');

interface CompanyInfo {
  name: string;
  website?: string;
  description?: string;
  subreddits?: string[];
  posts_per_week?: number;
}

interface PersonaInfo {
  username: string;
  info: string;
}

interface SEOQuery {
  keyword_id: string;
  keyword: string;
}

interface Post {
  post_id: string;
  subreddit: string;
  title: string;
  body: string;
  author_username: string;
  timestamp: string | Date;
  keyword_ids?: string;
}

interface Comment {
  comment_id: string;
  post_id: string;
  parent_comment_id?: string;
  comment_text: string;
  username: string;
  timestamp: string | Date;
}

interface ParsedData {
  company: CompanyInfo;
  personas: PersonaInfo[];
  seoQueries: SEOQuery[];
  posts: Post[];
  comments: Comment[];
}

/**
 * Parses Excel file with Company Info and Content Calendar sheets
 * Handles the specific SlideForge structure
 */
export function parseUnifiedExcel(fileBuffer: Buffer): ParsedData {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  
  console.log('Excel sheets found:', workbook.SheetNames);
  
  // Find Company Info sheet
  const companySheetName = workbook.SheetNames.find((name: string) => 
    name.toLowerCase().includes('company') || name.toLowerCase().includes('info')
  ) || workbook.SheetNames[0];
  
  console.log('Using sheet for company info:', companySheetName);
  
  const companySheet = workbook.Sheets[companySheetName];
  const companyData = parseCompanyInfoSheet(companySheet);
  
  console.log('Parsed company:', {
    name: companyData.company.name,
    personas: companyData.personas.length,
    queries: companyData.seoQueries.length,
  });

  // Find Content Calendar sheet
  const calendarSheetName = workbook.SheetNames.find((name: string) => 
    name.toLowerCase().includes('calendar') || name.toLowerCase().includes('content')
  ) || (workbook.SheetNames.length > 1 ? workbook.SheetNames[1] : workbook.SheetNames[0]);

  const calendarSheet = workbook.Sheets[calendarSheetName];

  const { posts, comments } = parseCalendarSheet(calendarSheet);
  
  return {
    company: companyData.company,
    personas: companyData.personas,
    seoQueries: companyData.seoQueries,
    posts,
    comments,
  };
}

function parseCompanyInfoSheet(sheet: any) {
  if (!sheet || !sheet['!ref']) {
    throw new Error('Invalid or empty sheet');
  }
  
  // Try using sheet_to_json first (easier for structured data)
  try {
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
    
    console.log('Sheet data (first 10 rows):', jsonData.slice(0, 10));
    
    const company: CompanyInfo = {
      name: '',
    };
    const personas: PersonaInfo[] = [];
    const seoQueries: SEOQuery[] = [];
    
    let foundPersonasHeader = false;
    let foundQueriesHeader = false;
    
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || row.length === 0) continue;
      
      const valueA = String(row[0] || '').trim();
      const valueB = String(row[1] || '').trim();
      
      // Debug first few rows
      if (i < 10) {
        console.log(`Row ${i}: A="${valueA}", B="${valueB.substring(0, 50)}..."`);
      }
      
      // Check for section headers - Personas section starts with "Username" header
      if (valueA.toLowerCase() === 'username' && valueB.toLowerCase() === 'info') {
        foundPersonasHeader = true;
        console.log(`Found Personas section at row ${i}`);
        continue;
      }
      
      // Check for SEO Queries section - starts with "keyword_id" header
      if (valueA.toLowerCase() === 'keyword_id' && valueB.toLowerCase() === 'keyword') {
        foundQueriesHeader = true;
        console.log(`Found Queries section at row ${i}`);
        continue;
      }
      
      // Parse Company fields (everything before personas/queries headers)
      if (!foundPersonasHeader && !foundQueriesHeader) {
        const lowerA = valueA.toLowerCase();
        if (lowerA === 'name' && valueB) {
          company.name = valueB;
          console.log(`Found company name: ${company.name}`);
        } else if (lowerA === 'website') {
          company.website = valueB || '';
        } else if (lowerA === 'description') {
          company.description = valueB || '';
        } else if (lowerA === 'subreddits' || lowerA === 'subreddit') {
          // Handle multi-line subreddits (split by newlines and filter)
          const subredditList = valueB.split(/\r?\n/)
            .map(s => s.trim())
            .filter(s => s && s.length > 0 && (s.startsWith('r/') || !s.includes(' ')));
          company.subreddits = subredditList;
          console.log(`Found ${subredditList.length} subreddits`);
        } else if (lowerA.includes('posts per week') || lowerA.includes('number of posts')) {
          company.posts_per_week = parseInt(valueB) || 3;
        }
      }
      
      // Parse Personas section (after "Username" header)
      if (foundPersonasHeader && !foundQueriesHeader) {
        // Skip header row and empty rows
        if (valueA.toLowerCase() === 'username' || valueA.toLowerCase() === 'info' || !valueA) {
          continue;
        }
        // If we have a username in column A (contains underscore) and info in column B
        if (valueA && valueB && valueA.includes('_')) {
          personas.push({
            username: valueA.trim(),
            info: valueB || '',
          });
          console.log(`Found persona: ${valueA.trim()}`);
        }
      }
      
      // Parse SEO Queries section (after "keyword_id" header)
      if (foundQueriesHeader) {
        // Skip header row and empty rows
        if (valueA.toLowerCase() === 'keyword_id' || valueA.toLowerCase() === 'keyword' || !valueA) {
          continue;
        }
        // If we have keyword_id in column A (starts with K) and keyword in column B
        if (valueA && valueB && valueA.trim().startsWith('K')) {
          seoQueries.push({
            keyword_id: valueA.trim(),
            keyword: valueB || '',
          });
          console.log(`Found query: ${valueA.trim()} - ${valueB}`);
        }
      }
    }
    
    // Fallback: if company name not found, search entire sheet for "Name" field
    if (!company.name) {
      console.log('Company name not found in structured parsing, trying fallback...');
      
      // Search all rows for "Name" in column A
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length < 2) continue;
        
        const valueA = String(row[0] || '').trim().toLowerCase();
        const valueB = String(row[1] || '').trim();
        
        // Look for "Name" field anywhere
        if (valueA === 'name' && valueB) {
          company.name = valueB;
          console.log('Found company name in fallback:', company.name);
          break;
        }
      }
      
      // If still not found, try cell-by-cell search
      if (!company.name) {
        const range = XLSX.utils.decode_range(sheet['!ref']);
        
        for (let row = 0; row <= range.e.r; row++) {
          try {
            const cellA = sheet[XLSX.utils.encode_cell({ r: row, c: 0 })];
            const cellB = sheet[XLSX.utils.encode_cell({ r: row, c: 1 })];
            
            const valueA = String(cellA?.v || '').trim().toLowerCase();
            const valueB = String(cellB?.v || '').trim();
          
            if (valueA === 'name' && valueB) {
              company.name = valueB;
              console.log('Found company name in cell search:', company.name);
              break;
            }
          } catch (err) {
            continue;
          }
        }
      }
    }
    
    return { company, personas, seoQueries };
  } catch (error) {
    throw new Error(`Failed to parse company info sheet: ${error}`);
  }
}

function parseCalendarSheet(sheet: any) {
  const posts: Post[] = [];
  const comments: Comment[] = [];
  
  if (!sheet || !sheet['!ref']) {
    return { posts, comments };
  }
  
  // Use sheet_to_json for easier parsing
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
  
  let postHeaders: string[] = [];
  let commentHeaders: string[] = [];
  let inPostsSection = false;
  let inCommentsSection = false;
  
  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.length === 0) continue;
    
    const firstCell = String(row[0] || '').trim().toLowerCase();
    
    // Detect posts section - starts with "post_id" header
    if (firstCell === 'post_id' && !inCommentsSection) {
      postHeaders = row.map((cell: any) => String(cell || '').trim().toLowerCase());
      inPostsSection = true;
      inCommentsSection = false;
      console.log('Found posts headers:', postHeaders);
      continue;
    }
    
    // Detect comments section - starts with "comment_id" header
    if (firstCell === 'comment_id') {
      commentHeaders = row.map((cell: any) => String(cell || '').trim().toLowerCase());
      inPostsSection = false;
      inCommentsSection = true;
      console.log('Found comments headers:', commentHeaders);
      continue;
    }
    
    // Parse post rows (post_id starts with "P")
    if (inPostsSection && postHeaders.length > 0 && firstCell && firstCell.startsWith('p')) {
      const rowData: any = {};
      postHeaders.forEach((header, idx) => {
        rowData[header] = row[idx] || '';
      });
      
      if (rowData['post_id']) {
        posts.push({
          post_id: String(rowData['post_id'] || ''),
          subreddit: String(rowData['subreddit'] || ''),
          title: String(rowData['title'] || ''),
          body: String(rowData['body'] || ''),
          author_username: String(rowData['author_username'] || ''),
          timestamp: parseTimestamp(rowData['timestamp']),
          keyword_ids: String(rowData['keyword_ids'] || ''),
        });
      }
    }
    
    // Parse comment rows (comment_id starts with "C")
    if (inCommentsSection && commentHeaders.length > 0 && firstCell && firstCell.startsWith('c')) {
      const rowData: any = {};
      commentHeaders.forEach((header, idx) => {
        rowData[header] = row[idx] || '';
      });
      
      if (rowData['comment_id']) {
        comments.push({
          comment_id: String(rowData['comment_id'] || ''),
          post_id: String(rowData['post_id'] || ''),
          parent_comment_id: String(rowData['parent_comment_id'] || ''),
          comment_text: String(rowData['comment_text'] || ''),
          username: String(rowData['username'] || ''),
          timestamp: parseTimestamp(rowData['timestamp']),
        });
      }
    }
  }
  
  console.log(`Parsed ${posts.length} posts and ${comments.length} comments`);
  return { posts, comments };
}

function parseCommaSeparated(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  return String(value).split(',').map(s => s.trim()).filter(s => s.length > 0);
}

function parseTimestamp(timestamp: string | Date | number): Date {
  if (timestamp instanceof Date) return timestamp;
  if (!timestamp || timestamp === '') return new Date();
  
  // Handle Excel serial date (number of days since 1900-01-01)
  if (typeof timestamp === 'number' || (!isNaN(Number(timestamp)) && String(timestamp).includes('.'))) {
    const excelDate = Number(timestamp);
    // Excel epoch is 1900-01-01, but Excel incorrectly treats 1900 as a leap year
    // So we need to adjust: Excel date 1 = 1900-01-01, but JS Date(1900,0,1) is different
    const jsDate = new Date(1900, 0, excelDate - 1);
    if (!isNaN(jsDate.getTime())) {
      return jsDate;
    }
  }
  
  const formats = [
    'yyyy-MM-dd HH:mm',
    'yyyy-MM-dd HH:mm:ss',
    'yyyy-MM-dd',
    'MM/dd/yyyy HH:mm',
  ];
  
  for (const format of formats) {
    try {
      return parse(String(timestamp), format, new Date());
    } catch {
      continue;
    }
  }
  
  const parsed = new Date(timestamp);
  return !isNaN(parsed.getTime()) ? parsed : new Date();
}

export function getDayOfWeek(date: Date): number {
  return getDay(date);
}

export function getWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 0 });
}

export function inferPostType(title: string, body: string): 'question' | 'story' | 'advice' {
  const text = (title + ' ' + body).toLowerCase();
  if (text.includes('?') || text.includes('how') || text.includes('what') || text.includes('which')) {
    return 'question';
  }
  if (text.includes('experience') || text.includes('story') || text.includes('tried') || text.includes('used')) {
    return 'story';
  }
  return 'advice';
}

