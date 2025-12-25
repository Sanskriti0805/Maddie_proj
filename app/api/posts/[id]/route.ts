import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

/**
 * Update a post
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { topic, planned_title, planned_body, post_type, posting_strategy } = body;

    const supabase = createServerClient();

    const updateData: any = {};
    if (topic !== undefined) updateData.topic = topic;
    if (planned_title !== undefined) updateData.planned_title = planned_title;
    if (planned_body !== undefined) updateData.planned_body = planned_body;
    if (post_type !== undefined) updateData.post_type = post_type;
    if (posting_strategy !== undefined) updateData.posting_strategy = posting_strategy;

    const { data, error } = await supabase
      .from('calendar_posts')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ post: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update post' },
      { status: 500 }
    );
  }
}

