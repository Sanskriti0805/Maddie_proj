import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { parseExcelFile } from '@/lib/utils/excel-import';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'File must be an Excel file (.xlsx or .xls)' },
        { status: 400 }
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse Excel file
    const parsedData = parseExcelFile(buffer);

    const supabase = createServerClient();

    // Create company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: parsedData.company.name,
        description: parsedData.company.description || null,
        target_users: parsedData.company.target_users,
        pain_points: parsedData.company.pain_points,
        tone_positioning: parsedData.company.tone_positioning || null,
        website_url: parsedData.company.website_url || null,
      })
      .select()
      .single();

    if (companyError || !company) {
      return NextResponse.json(
        { error: `Failed to create company: ${companyError?.message}` },
        { status: 500 }
      );
    }

    const companyId = company.id;
    const results = {
      company,
      personas: [] as any[],
      subreddits: [] as any[],
    };

    // Create personas
    if (parsedData.personas.length > 0) {
      const personasToInsert = parsedData.personas.map(p => ({
        company_id: companyId,
        name: p.name,
        tone: p.tone,
        expertise: p.expertise,
        reddit_account: p.reddit_account || null,
      }));

      const { data: personas, error: personasError } = await supabase
        .from('personas')
        .insert(personasToInsert)
        .select();

      if (!personasError && personas) {
        results.personas = personas;
      }
    }

    // Create subreddits
    if (parsedData.subreddits.length > 0) {
      const subredditsToInsert = parsedData.subreddits.map(s => ({
        company_id: companyId,
        name: s.name,
        rules: s.rules || null,
        min_cooldown_days: s.min_cooldown_days || 7,
        max_posts_per_week: s.max_posts_per_week || 2,
        size_category: s.size_category || 'medium',
      }));

      const { data: subreddits, error: subredditsError } = await supabase
        .from('subreddits')
        .insert(subredditsToInsert)
        .select();

      if (!subredditsError && subreddits) {
        results.subreddits = subreddits;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Imported company "${parsedData.company.name}" with ${results.personas.length} personas and ${results.subreddits.length} subreddits`,
      data: results,
    });
  } catch (error: any) {
    console.error('Excel import error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import Excel file' },
      { status: 500 }
    );
  }
}

