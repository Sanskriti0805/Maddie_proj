'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Company, Persona, Subreddit, SEOQuery } from '@/types';

export default function CompanyPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.id as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [subreddits, setSubreddits] = useState<Subreddit[]>([]);
  const [seoQueries, setSeoQueries] = useState<SEOQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (companyId) {
      fetchData();
    }
  }, [companyId]);

  const fetchData = async () => {
    try {
      const [companyRes, personasRes, subredditsRes] = await Promise.all([
        fetch(`/api/companies/${companyId}`),
        fetch(`/api/personas?company_id=${companyId}`),
        fetch(`/api/subreddits?company_id=${companyId}`),
      ]);

      const companyData = await companyRes.json();
      const personasData = await personasRes.json();
      const subredditsData = await subredditsRes.json();

      setCompany(companyData.company);
      setPersonas(personasData.personas || []);
      setSubreddits(subredditsData.subreddits || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCalendar = async () => {
    if (!company) return;

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() + (7 - weekStart.getDay())); // Next Sunday
    weekStart.setHours(0, 0, 0, 0);

    setGenerating(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          week_start_date: weekStart.toISOString(),
          posts_per_week: 5, // Default
        }),
      });

      const data = await res.json();
      if (data.calendar) {
        router.push(`/dashboard/calendars/${data.calendar.id}`);
      } else {
        alert('Failed to generate calendar: ' + (data.error || 'Unknown error'));
      }
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Company not found</p>
          <Link href="/dashboard" className="text-primary-600 hover:text-primary-700">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700 mb-1 block">
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
            </div>
            <button
              onClick={handleGenerateCalendar}
              disabled={generating || personas.length === 0 || subreddits.length === 0}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {generating ? 'Generating...' : 'Generate Calendar'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Company Info</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Description</p>
                <p className="text-gray-900">{company.description || 'No description'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Target Users</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {company.target_users.map((user, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                      {user}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Pain Points</p>
                <ul className="list-disc list-inside text-gray-900 mt-1">
                  {company.pain_points.map((point, i) => (
                    <li key={i} className="text-sm">{point}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Personas ({personas.length})</h2>
            {personas.length === 0 ? (
              <p className="text-gray-500 text-sm">No personas configured</p>
            ) : (
              <ul className="space-y-3">
                {personas.map((persona) => (
                  <li key={persona.id} className="border-b pb-3 last:border-0">
                    <p className="font-medium text-gray-900">{persona.name}</p>
                    <p className="text-sm text-gray-500">Tone: {persona.tone}</p>
                    <p className="text-sm text-gray-500">Expertise: {persona.expertise.join(', ')}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Subreddits ({subreddits.length})</h2>
            {subreddits.length === 0 ? (
              <p className="text-gray-500 text-sm">No subreddits configured</p>
            ) : (
              <ul className="space-y-3">
                {subreddits.map((subreddit) => (
                  <li key={subreddit.id} className="border-b pb-3 last:border-0">
                    <p className="font-medium text-gray-900">{subreddit.name}</p>
                    <p className="text-sm text-gray-500">
                      {subreddit.size_category} • {subreddit.max_posts_per_week} posts/week
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {(personas.length === 0 || subreddits.length === 0) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 text-sm">
              {personas.length === 0 && 'Add at least one persona. '}
              {subreddits.length === 0 && 'Add at least one subreddit. '}
              Calendar generation requires both personas and subreddits.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

