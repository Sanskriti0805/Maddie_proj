'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { CalendarPostWithDetails, CalendarQualityScore } from '@/types';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function CalendarPage() {
  const params = useParams();
  const calendarId = params.id as string;

  const [calendar, setCalendar] = useState<any>(null);
  const [posts, setPosts] = useState<CalendarPostWithDetails[]>([]);
  const [quality, setQuality] = useState<CalendarQualityScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [spamWarnings, setSpamWarnings] = useState<any[]>([]);
  const [generatingNextWeek, setGeneratingNextWeek] = useState(false);
  const [generatingPosts, setGeneratingPosts] = useState(false);
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editingReply, setEditingReply] = useState<string | null>(null);

  useEffect(() => {
    if (calendarId) {
      fetchCalendar();
    }
  }, [calendarId]);

  const fetchCalendar = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/calendars/${calendarId}`);
      
      if (!res.ok) {
        throw new Error(`Failed to fetch calendar: ${res.statusText}`);
      }
      
      const data = await res.json();

      console.log('Fetched calendar data:', {
        calendarId: data.calendar?.id,
        postsCount: data.posts?.length || 0,
        posts: data.posts,
      });

      setCalendar(data.calendar);
      setPosts(data.posts || []);

      // Calculate quality if not provided
      if (data.quality) {
        setQuality(data.quality);
      }
      
      // Load spam warnings
      if (data.calendar?.spam_warnings) {
        setSpamWarnings(data.calendar.spam_warnings);
      }
    } catch (error) {
      console.error('Failed to fetch calendar:', error);
      alert(`Error loading calendar: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!calendar) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Calendar not found</p>
          <Link href="/dashboard" className="text-primary-600 hover:text-primary-700">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const postsByDay = posts.reduce((acc, post) => {
    const day = post.day_of_week;
    if (!acc[day]) acc[day] = [];
    acc[day].push(post);
    return acc;
  }, {} as Record<number, CalendarPostWithDetails[]>);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700 mb-1 block">
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">
                Calendar - Week of {new Date(calendar.week_start_date).toLocaleDateString()}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  const res = await fetch(`/api/calendars/${calendarId}/debug`);
                  const data = await res.json();
                  console.log('Debug info:', data);
                  alert(`Posts for this calendar: ${data.posts_for_this_calendar}\nTotal posts in DB: ${data.all_posts_in_db}\nPosts by calendar: ${JSON.stringify(data.posts_by_calendar_id, null, 2)}`);
                }}
                className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700"
                title="Debug: Check database"
              >
                Debug
              </button>
              <button
                onClick={fetchCalendar}
                className="bg-gray-600 text-white px-4 py-2 rounded text-sm hover:bg-gray-700"
                title="Refresh to see latest posts"
              >
                Refresh
              </button>
              {(posts.length === 0 || (calendar && posts.length < calendar.posts_per_week)) && (
                <button
                  onClick={handleGeneratePosts}
                  disabled={generatingPosts}
                  className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50"
                  title={posts.length === 0 ? 'Generate posts for this calendar' : `Regenerate posts (currently ${posts.length}/${calendar?.posts_per_week || 0})`}
                >
                  {generatingPosts ? 'Generating Posts...' : posts.length === 0 ? 'Generate Posts' : 'Regenerate Posts'}
                </button>
              )}
              <button
                onClick={handleGenerateNextWeek}
                disabled={generatingNextWeek}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {generatingNextWeek ? 'Generating...' : 'Generate Next Week'}
              </button>
              <span className={`px-3 py-1 rounded text-sm font-medium ${
                calendar.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                calendar.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                'bg-green-100 text-green-800'
              }`}>
                {calendar.status}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {spamWarnings.length > 0 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-yellow-400 text-xl">⚠️</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Spam Risk Warnings</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <ul className="list-disc list-inside space-y-1">
                    {spamWarnings.map((warning: any, i: number) => (
                      <li key={i}>
                        <strong>{warning.severity.toUpperCase()}:</strong> {warning.message}
                        {warning.recommendation && (
                          <span className="block ml-4 mt-1">→ {warning.recommendation}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {quality && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quality Score</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-9 gap-4">
              <div>
                <p className="text-sm text-gray-500">Overall</p>
                <p className="text-2xl font-bold text-gray-900">{quality.overall}/10</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Topic Diversity</p>
                <p className="text-2xl font-bold text-gray-900">{quality.topic_diversity}/10</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Persona Rotation</p>
                <p className="text-2xl font-bold text-gray-900">{quality.persona_rotation}/10</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Subreddit Distribution</p>
                <p className="text-2xl font-bold text-gray-900">{quality.subreddit_distribution}/10</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Reply Naturalness</p>
                <p className="text-2xl font-bold text-gray-900">{quality.reply_naturalness}/10</p>
              </div>
              {quality.realism !== undefined && (
                <div>
                  <p className="text-sm text-gray-500">Realism</p>
                  <p className="text-2xl font-bold text-gray-900">{quality.realism}/10</p>
                </div>
              )}
              {quality.subreddit_fit !== undefined && (
                <div>
                  <p className="text-sm text-gray-500">Subreddit Fit</p>
                  <p className="text-2xl font-bold text-gray-900">{quality.subreddit_fit}/10</p>
                </div>
              )}
              {quality.spam_risk !== undefined && (
                <div>
                  <p className="text-sm text-gray-500">Spam Risk</p>
                  <p className="text-2xl font-bold text-gray-900">{quality.spam_risk}/10</p>
                </div>
              )}
              {quality.persona_distinctiveness !== undefined && (
                <div>
                  <p className="text-sm text-gray-500">Persona Distinctiveness</p>
                  <p className="text-2xl font-bold text-gray-900">{quality.persona_distinctiveness}/10</p>
                </div>
              )}
            </div>
            {quality.issues.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium text-gray-900 mb-2">Issues:</p>
                <ul className="list-disc list-inside text-sm text-gray-600">
                  {quality.issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Debug: Show distribution info */}
        {calendar && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>Calendar Info:</strong> {calendar.posts_per_week} posts/week planned. 
              Currently showing {posts.length} post(s) across {Object.keys(postsByDay).filter(d => postsByDay[parseInt(d)].length > 0).length} day(s).
            </p>
            {posts.length < calendar.posts_per_week && (
              <p className="text-sm text-yellow-800 mt-2">
                ⚠️ Missing {calendar.posts_per_week - posts.length} post(s). 
                {posts.length === 0 && ' Click "Generate Posts" to create posts for this calendar.'}
              </p>
            )}
          </div>
        )}

        <div className="space-y-6">
          {DAYS.map((dayName, dayIndex) => {
            const dayPosts = postsByDay[dayIndex] || [];
            return (
              <div key={dayIndex} className="bg-white rounded-lg shadow">
                <div className="p-4 border-b bg-gray-50">
                  <h2 className="text-lg font-semibold text-gray-900">{dayName}</h2>
                  <p className="text-sm text-gray-500">
                    {dayPosts.length} post(s) {dayPosts.length === 0 && calendar && calendar.posts_per_week > 0 && (
                      <span className="text-yellow-600">(Expected posts may not have been generated)</span>
                    )}
                  </p>
                </div>
                <div className="p-4 space-y-4">
                  {dayPosts.length === 0 ? (
                    <p className="text-gray-500 text-sm">No posts scheduled</p>
                  ) : (
                    dayPosts.map((post) => (
                      <div key={post.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h3 className="font-semibold text-lg text-gray-900">{post.topic}</h3>
                              {(post as any).posting_strategy && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded capitalize">
                                  {(post as any).posting_strategy.replace('_', ' ')}
                                </span>
                              )}
                              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded capitalize">
                                {post.post_type}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 mb-3 text-sm">
                              <div>
                                <span className="text-gray-500">Subreddit:</span>
                                <span className="ml-2 font-medium text-gray-900">r/{post.subreddit?.name || 'Unknown'}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Persona:</span>
                                <span className="ml-2 font-medium text-gray-900">{post.persona?.name || 'Unknown'}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Order:</span>
                                <span className="ml-2 font-medium text-gray-900">{post.order_in_day || 1}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Day:</span>
                                <span className="ml-2 font-medium text-gray-900">{DAYS[post.day_of_week]}</span>
                              </div>
                            </div>

                            {post.planned_title && (
                              <div className="mt-3 p-3 bg-gray-50 rounded border-l-4 border-blue-500">
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Planned Title</p>
                                <p className="text-base text-gray-900 font-medium">"{post.planned_title}"</p>
                              </div>
                            )}
                            
                            {post.planned_body && (
                              <div className="mt-3 p-3 bg-gray-50 rounded">
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Planned Body</p>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{post.planned_body}</p>
                              </div>
                            )}

                            {!post.planned_title && !post.planned_body && (
                              <div className="mt-3 p-3 bg-yellow-50 rounded border border-yellow-200">
                                <p className="text-sm text-yellow-800">⚠️ No content generated yet. Click Edit to add content.</p>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingPost(post.id);
                            }}
                            className="ml-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors flex-shrink-0"
                          >
                            Edit
                          </button>
                        </div>
                        {post.replies && post.replies.length > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <p className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                              <span>💬 Planned Replies ({post.replies.length})</span>
                            </p>
                            <div className="space-y-3">
                              {post.replies.map((reply: any) => (
                                <div key={reply.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 flex-wrap mb-2">
                                        <span className="font-medium text-gray-900">{reply.persona?.name || 'Unknown'}</span>
                                        <span className="text-gray-400">•</span>
                                        <span className="text-sm text-gray-600 capitalize">{reply.intent} intent</span>
                                        <span className="text-gray-400">•</span>
                                        <span className="text-sm text-gray-600">After {reply.order_after_post}h</span>
                                        {reply.tone && (
                                          <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded capitalize">
                                            {reply.tone} tone
                                          </span>
                                        )}
                                        {reply.emotion && (
                                          <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded capitalize">
                                            {reply.emotion}
                                          </span>
                                        )}
                                      </div>
                                      {reply.planned_content ? (
                                        <div className="mt-2 p-3 bg-white rounded border-l-4 border-green-500">
                                          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">"{reply.planned_content}"</p>
                                        </div>
                                      ) : (
                                        <div className="mt-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                                          <p className="text-xs text-yellow-800">⚠️ No reply content generated yet</p>
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingReply(reply.id);
                                      }}
                                      className="ml-3 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors flex-shrink-0"
                                    >
                                      Edit
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Edit Post Modal */}
      {editingPost && (
        <EditPostModal
          post={posts.find(p => p.id === editingPost)}
          onClose={() => setEditingPost(null)}
          onSave={async (updates) => {
            try {
              const res = await fetch(`/api/posts/${editingPost}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
              });
              if (res.ok) {
                await fetchCalendar();
                setEditingPost(null);
              } else {
                const data = await res.json();
                alert(data.error || 'Failed to update post');
              }
            } catch (error) {
              console.error('Error updating post:', error);
              alert('Failed to update post');
            }
          }}
        />
      )}

      {/* Edit Reply Modal */}
      {editingReply && (
        <EditReplyModal
          reply={posts.flatMap(p => p.replies || []).find((r: any) => r.id === editingReply)}
          onClose={() => setEditingReply(null)}
          onSave={async (updates) => {
            try {
              const res = await fetch(`/api/replies/${editingReply}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
              });
              if (res.ok) {
                await fetchCalendar();
                setEditingReply(null);
              } else {
                const data = await res.json();
                alert(data.error || 'Failed to update reply');
              }
            } catch (error) {
              console.error('Error updating reply:', error);
              alert('Failed to update reply');
            }
          }}
        />
      )}
    </div>
  );

  async function handleGenerateNextWeek() {
    setGeneratingNextWeek(true);
    try {
      const res = await fetch('/api/generate/next-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_calendar_id: calendarId }),
      });

      const data = await res.json();
      if (res.ok) {
        // Redirect to new calendar
        window.location.href = `/dashboard/calendars/${data.calendar.id}`;
      } else {
        alert(data.error || 'Failed to generate next week');
      }
    } catch (error) {
      console.error('Error generating next week:', error);
      alert('Failed to generate next week');
    } finally {
      setGeneratingNextWeek(false);
    }
  }

  async function handleGeneratePosts() {
    setGeneratingPosts(true);
    try {
      const res = await fetch(`/api/calendars/${calendarId}/generate`, {
        method: 'POST',
      });

      const data = await res.json();
      
      // Check if posts were actually generated
      if (res.ok && data.posts > 0) {
        alert(`Successfully generated ${data.posts} posts and ${data.replies} replies! Refreshing page...`);
        // Force a hard page reload to ensure we get the latest data
        window.location.reload();
      } else if (res.ok && data.success) {
        // Even if posts count is 0, if success is true, refresh anyway
        alert(`Generation completed. Refreshing page...`);
        window.location.reload();
      } else {
        // Show detailed error message
        const errorMsg = data.message || data.error || 'Failed to generate posts';
        const debugInfo = data.debug ? `\n\nDebug info: ${JSON.stringify(data.debug, null, 2)}` : '';
        alert(`${errorMsg}${debugInfo}`);
      }
    } catch (error) {
      console.error('Error generating posts:', error);
      alert('Failed to generate posts. Check console for details.');
    } finally {
      setGeneratingPosts(false);
    }
  }
}

// Edit Post Modal Component
function EditPostModal({ post, onClose, onSave }: { post: any; onClose: () => void; onSave: (updates: any) => Promise<void> }) {
  const [topic, setTopic] = useState(post?.topic || '');
  const [plannedTitle, setPlannedTitle] = useState(post?.planned_title || '');
  const [plannedBody, setPlannedBody] = useState(post?.planned_body || '');
  const [postType, setPostType] = useState(post?.post_type || 'question');
  const [postingStrategy, setPostingStrategy] = useState((post as any)?.posting_strategy || '');
  const [saving, setSaving] = useState(false);

  if (!post) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        topic,
        planned_title: plannedTitle,
        planned_body: plannedBody,
        post_type: postType,
        posting_strategy: postingStrategy,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Edit Post</h2>
          <p className="text-sm text-gray-500 mt-1">
            {post.subreddit?.name && `r/${post.subreddit.name}`} • {post.persona?.name}
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Post Type</label>
            <select
              value={postType}
              onChange={(e) => setPostType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="question">Question</option>
              <option value="story">Story</option>
              <option value="advice">Advice</option>
              <option value="discussion">Discussion</option>
              <option value="tip">Tip</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Posting Strategy</label>
            <select
              value={postingStrategy}
              onChange={(e) => setPostingStrategy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None</option>
              <option value="awareness">Awareness</option>
              <option value="authority">Authority</option>
              <option value="subtle_product">Subtle Product</option>
              <option value="value">Value</option>
              <option value="engagement">Engagement</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Planned Title</label>
            <input
              type="text"
              value={plannedTitle}
              onChange={(e) => setPlannedTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter the Reddit post title..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Planned Body</label>
            <textarea
              value={plannedBody}
              onChange={(e) => setPlannedBody(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter the Reddit post body content..."
            />
          </div>
        </div>
        <div className="p-6 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Edit Reply Modal Component
function EditReplyModal({ reply, onClose, onSave }: { reply: any; onClose: () => void; onSave: (updates: any) => Promise<void> }) {
  const [plannedContent, setPlannedContent] = useState(reply?.planned_content || '');
  const [intent, setIntent] = useState(reply?.intent || 'support');
  const [orderAfterPost, setOrderAfterPost] = useState(reply?.order_after_post || 1);
  const [tone, setTone] = useState(reply?.tone || '');
  const [emotion, setEmotion] = useState(reply?.emotion || '');
  const [saving, setSaving] = useState(false);

  if (!reply) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        planned_content: plannedContent,
        intent,
        order_after_post: orderAfterPost,
        tone,
        emotion,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Edit Reply</h2>
          <p className="text-sm text-gray-500 mt-1">
            {reply.persona?.name || 'Unknown persona'}
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Intent</label>
            <select
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="support">Support</option>
              <option value="disagree">Disagree</option>
              <option value="question">Question</option>
              <option value="share_experience">Share Experience</option>
              <option value="debate">Debate</option>
              <option value="curiosity">Curiosity</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hours After Post</label>
              <input
                type="number"
                value={orderAfterPost}
                onChange={(e) => setOrderAfterPost(parseInt(e.target.value) || 1)}
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
              <input
                type="text"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="e.g., friendly, professional"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Emotion</label>
            <input
              type="text"
              value={emotion}
              onChange={(e) => setEmotion(e.target.value)}
              placeholder="e.g., excited, concerned, curious"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Planned Content</label>
            <textarea
              value={plannedContent}
              onChange={(e) => setPlannedContent(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter the reply content..."
            />
          </div>
        </div>
        <div className="p-6 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

