import XLSX from 'xlsx';
import { parse, getDay, startOfWeek } from 'date-fns';

interface ExcelPost {
  post_id: string;
  subreddit: string;
  title: string;
  body: string;
  author_username: string;
  timestamp: string | Date;
  keyword_ids?: string;
}

interface ExcelComment {
  comment_id: string;
  post_id: string;
  parent_comment_id?: string;
  comment_text: string;
  username: string;
  timestamp: string | Date;
}

interface ParsedCalendarData {
  posts: ExcelPost[];
  comments: ExcelComment[];
}

/**
 * Parses Excel file with Posts and Comments structure
 * Expected Excel structure:
 * 
 * Sheet 1: Posts
 * - Row 1: Headers (post_id, subreddit, title, body, author_username, timestamp, keyword_ids)
 * - Row 2+: Data
 * 
 * Sheet 2: Comments
 * - Row 1: Headers (comment., post_id, parent_comment_id, comment_text, username, timestamp)
 * - Row 2+: Data
 */
export function parseCalendarExcel(fileBuffer: Buffer): ParsedCalendarData {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  
  const posts: ExcelPost[] = [];
  const comments: ExcelComment[] = [];

  // Find Posts sheet (look for "Posts" in sheet name or first sheet)
  let postsSheetName = workbook.SheetNames.find(name => 
    name.toLowerCase().includes('post')
  ) || workbook.SheetNames[0];
  
  const postsSheet = workbook.Sheets[postsSheetName];
  const postsData = XLSX.utils.sheet_to_json(postsSheet) as any[];

  postsData.forEach((row: any) => {
    if (row.post_id || row['post_id']) {
      posts.push({
        post_id: row.post_id || row['post_id'] || '',
        subreddit: row.subreddit || row['subreddit'] || '',
        title: row.title || row['title'] || '',
        body: row.body || row['body'] || '',
        author_username: row.author_username || row['author_username'] || row['author'] || '',
        timestamp: parseTimestamp(row.timestamp || row['timestamp'] || ''),
        keyword_ids: row.keyword_ids || row['keyword_ids'] || '',
      });
    }
  });

  // Find Comments sheet (look for "Comment" in sheet name or second sheet)
  let commentsSheetName = workbook.SheetNames.find(name => 
    name.toLowerCase().includes('comment')
  ) || (workbook.SheetNames.length > 1 ? workbook.SheetNames[1] : null);

  if (commentsSheetName) {
    const commentsSheet = workbook.Sheets[commentsSheetName];
    const commentsData = XLSX.utils.sheet_to_json(commentsSheet) as any[];

    commentsData.forEach((row: any) => {
      const commentId = row['comment.'] || row.comment_id || row['comment_id'] || row['Comment'] || '';
      if (commentId || row.post_id || row['post_id']) {
        comments.push({
          comment_id: commentId,
          post_id: row.post_id || row['post_id'] || '',
          parent_comment_id: row.parent_comment_id || row['parent_comment_id'] || '',
          comment_text: row.comment_text || row['comment_text'] || row['Comment Text'] || '',
          username: row.username || row['username'] || row['Username'] || '',
          timestamp: parseTimestamp(row.timestamp || row['timestamp'] || ''),
        });
      }
    });
  }

  return { posts, comments };
}

/**
 * Parse timestamp string to Date object
 * Handles formats like: "2025-12-08 14:12", "2025-12-08T14:12:00", etc.
 */
function parseTimestamp(timestamp: string | Date): Date {
  if (timestamp instanceof Date) {
    return timestamp;
  }
  
  if (!timestamp || timestamp === '') {
    return new Date();
  }

  // Try various date formats
  const formats = [
    'yyyy-MM-dd HH:mm',
    'yyyy-MM-dd HH:mm:ss',
    'yyyy-MM-dd',
    'MM/dd/yyyy HH:mm',
    'MM/dd/yyyy',
  ];

  for (const format of formats) {
    try {
      return parse(timestamp, format, new Date());
    } catch {
      continue;
    }
  }

  // Fallback to native Date parsing
  const parsed = new Date(timestamp);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return new Date(); // Default to now if parsing fails
}

/**
 * Convert Date to day of week (0=Sunday, 6=Saturday)
 */
export function getDayOfWeek(date: Date): number {
  return getDay(date);
}

/**
 * Get week start date (Sunday) for a given date
 */
export function getWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 0 });
}

/**
 * Infer post type from title/body
 */
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

