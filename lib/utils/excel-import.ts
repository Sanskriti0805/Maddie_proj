import XLSX from 'xlsx';
import type { Company, Persona, Subreddit } from '@/types';

interface ExcelCompanyData {
  name: string;
  description?: string;
  target_users: string[];
  pain_points: string[];
  tone_positioning?: string;
  website_url?: string;
}

interface ExcelPersonaData {
  name: string;
  tone: string;
  expertise: string[];
  reddit_account?: string;
}

interface ExcelSubredditData {
  name: string;
  rules?: string;
  min_cooldown_days?: number;
  max_posts_per_week?: number;
  size_category?: 'small' | 'medium' | 'large';
}

interface ParsedExcelData {
  company: ExcelCompanyData;
  personas: ExcelPersonaData[];
  subreddits: ExcelSubredditData[];
}

/**
 * Parses Excel file and extracts company, personas, and subreddits data
 * Expected Excel structure:
 * 
 * Sheet 1: Company Info
 * - Row 1: Headers (name, description, target_users, pain_points, tone_positioning, website_url)
 * - Row 2+: Data
 * 
 * Sheet 2: Personas (optional)
 * - Row 1: Headers (name, tone, expertise, reddit_account)
 * - Row 2+: Data
 * 
 * Sheet 3: Subreddits (optional)
 * - Row 1: Headers (name, rules, min_cooldown_days, max_posts_per_week, size_category)
 * - Row 2+: Data
 */
export function parseExcelFile(fileBuffer: Buffer): ParsedExcelData {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  
  // Parse Company Info (Sheet 1 or first sheet)
  const companySheet = workbook.Sheets[workbook.SheetNames[0]];
  const companyData = XLSX.utils.sheet_to_json(companySheet)[0] as any;
  
  if (!companyData || !companyData.name) {
    throw new Error('Company name is required in the first sheet');
  }

  const company: ExcelCompanyData = {
    name: companyData.name || companyData['Company Name'] || '',
    description: companyData.description || companyData['Description'] || '',
    target_users: parseArrayField(companyData.target_users || companyData['Target Users'] || ''),
    pain_points: parseArrayField(companyData.pain_points || companyData['Pain Points'] || ''),
    tone_positioning: companyData.tone_positioning || companyData['Tone & Positioning'] || '',
    website_url: companyData.website_url || companyData['Website URL'] || '',
  };

  // Parse Personas (Sheet 2, if exists)
  const personas: ExcelPersonaData[] = [];
  if (workbook.SheetNames.length > 1) {
    const personasSheet = workbook.Sheets[workbook.SheetNames[1]];
    const personasData = XLSX.utils.sheet_to_json(personasSheet) as any[];
    
    personasData.forEach((row: any) => {
      if (row.name || row['Name']) {
        personas.push({
          name: row.name || row['Name'] || '',
          tone: row.tone || row['Tone'] || 'helpful',
          expertise: parseArrayField(row.expertise || row['Expertise'] || ''),
          reddit_account: row.reddit_account || row['Reddit Account'] || '',
        });
      }
    });
  }

  // Parse Subreddits (Sheet 3, if exists)
  const subreddits: ExcelSubredditData[] = [];
  if (workbook.SheetNames.length > 2) {
    const subredditsSheet = workbook.Sheets[workbook.SheetNames[2]];
    const subredditsData = XLSX.utils.sheet_to_json(subredditsSheet) as any[];
    
    subredditsData.forEach((row: any) => {
      if (row.name || row['Name'] || row.subreddit || row['Subreddit']) {
        subreddits.push({
          name: row.name || row['Name'] || row.subreddit || row['Subreddit'] || '',
          rules: row.rules || row['Rules'] || '',
          min_cooldown_days: parseInt(row.min_cooldown_days || row['Min Cooldown Days'] || '7'),
          max_posts_per_week: parseInt(row.max_posts_per_week || row['Max Posts Per Week'] || '2'),
          size_category: (row.size_category || row['Size Category'] || 'medium') as 'small' | 'medium' | 'large',
        });
      }
    });
  }

  return { company, personas, subreddits };
}

/**
 * Helper to parse array fields from Excel (can be comma-separated string or JSON array)
 */
function parseArrayField(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    // Try JSON first
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Not JSON, try comma-separated
    }
    // Comma-separated string
    return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }
  return [];
}

/**
 * Creates a template Excel file for users to fill in
 */
export function createExcelTemplate(): Buffer {
  const workbook = XLSX.utils.book_new();

  // Company Info Sheet
  const companyData = [
    {
      name: 'SlideForge',
      description: 'AI-powered presentation tool for founders and marketers',
      target_users: 'founders, marketers, startups',
      pain_points: 'time-consuming presentations, design skills, brand consistency',
      tone_positioning: 'Helpful and authentic, never salesy',
      website_url: 'https://slideforge.ai',
    },
  ];
  const companySheet = XLSX.utils.json_to_sheet(companyData);
  XLSX.utils.book_append_sheet(workbook, companySheet, 'Company Info');

  // Personas Sheet
  const personasData = [
    {
      name: 'Sarah - Growth Marketer',
      tone: 'helpful',
      expertise: 'marketing, growth, content',
      reddit_account: '',
    },
    {
      name: 'Alex - Startup Founder',
      tone: 'experienced',
      expertise: 'startups, product, funding',
      reddit_account: '',
    },
  ];
  const personasSheet = XLSX.utils.json_to_sheet(personasData);
  XLSX.utils.book_append_sheet(workbook, personasSheet, 'Personas');

  // Subreddits Sheet
  const subredditsData = [
    {
      name: 'r/startups',
      rules: 'No self-promotion, be helpful and authentic',
      min_cooldown_days: 7,
      max_posts_per_week: 2,
      size_category: 'large',
    },
    {
      name: 'r/entrepreneur',
      rules: 'Focus on value, no direct promotion',
      min_cooldown_days: 5,
      max_posts_per_week: 2,
      size_category: 'large',
    },
  ];
  const subredditsSheet = XLSX.utils.json_to_sheet(subredditsData);
  XLSX.utils.book_append_sheet(workbook, subredditsSheet, 'Subreddits');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

