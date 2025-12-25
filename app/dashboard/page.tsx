'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Company, ContentCalendar } from '@/types';

export default function Dashboard() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [calendars, setCalendars] = useState<ContentCalendar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [companiesRes, calendarsRes] = await Promise.all([
        fetch('/api/companies'),
        fetch('/api/calendars'),
      ]);

      const companiesData = await companiesRes.json();
      const calendarsData = await calendarsRes.json();

      setCompanies(companiesData.companies || []);
      setCalendars(calendarsData.calendars || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <Link
              href="/"
              className="text-gray-600 hover:text-gray-900"
            >
              Home
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Companies</h3>
            <p className="text-3xl font-bold text-gray-900">{companies.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Calendars</h3>
            <p className="text-3xl font-bold text-gray-900">{calendars.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Draft Calendars</h3>
            <p className="text-3xl font-bold text-gray-900">
              {calendars.filter(c => c.status === 'draft').length}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Companies</h2>
                <Link
                  href="/dashboard/companies/new"
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  + New
                </Link>
              </div>
            </div>
            <div className="p-6">
              {loading ? (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                </div>
              ) : companies.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No companies yet</p>
              ) : (
                <ul className="space-y-3">
                  {companies.slice(0, 5).map((company) => (
                    <li key={company.id}>
                      <Link
                        href={`/dashboard/companies/${company.id}`}
                        className="block p-3 rounded-lg hover:bg-gray-50"
                      >
                        <p className="font-medium text-gray-900">{company.name}</p>
                        <p className="text-sm text-gray-500">{company.target_users.length} target users</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Recent Calendars</h2>
            </div>
            <div className="p-6">
              {loading ? (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                </div>
              ) : calendars.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No calendars yet</p>
              ) : (
                <ul className="space-y-3">
                  {calendars.slice(0, 5).map((calendar) => (
                    <li key={calendar.id}>
                      <Link
                        href={`/dashboard/calendars/${calendar.id}`}
                        className="block p-3 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">
                              Week of {new Date(calendar.week_start_date).toLocaleDateString()}
                            </p>
                            <p className="text-sm text-gray-500">
                              {calendar.posts_per_week} posts • {calendar.status}
                            </p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded ${
                            calendar.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                            calendar.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {calendar.status}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

