import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

/**
 * Update a reply
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { planned_content, intent, order_after_post, tone, emotion } = body;

    const supabase = createServerClient();

    const updateData: any = {};
    if (planned_content !== undefined) updateData.planned_content = planned_content;
    if (intent !== undefined) updateData.intent = intent;
    if (order_after_post !== undefined) updateData.order_after_post = order_after_post;
    if (tone !== undefined) updateData.tone = tone;
    if (emotion !== undefined) updateData.emotion = emotion;

    const { data, error } = await supabase
      .from('calendar_replies')
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

    return NextResponse.json({ reply: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update reply' },
      { status: 500 }
    );
  }
}

