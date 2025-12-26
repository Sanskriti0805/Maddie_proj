import { NextResponse } from 'next/server';
import { createExcelTemplate } from '@/lib/utils/excel-import';

/**
 * GET /api/import/template
 * Downloads an Excel template file for importing company data
 */
export async function GET() {
  try {
    const templateBuffer = createExcelTemplate();

    return new NextResponse(templateBuffer as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="reddit-mastermind-template.xlsx"',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to generate template' },
      { status: 500 }
    );
  }
}

