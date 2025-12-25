'use client';

import { useState } from 'react';
import type { Company, Persona, Subreddit } from '@/types';

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
}

export default function TestingDashboard() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);

  const runTests = async () => {
    if (!selectedCompany) {
      alert('Please select a company first');
      return;
    }

    setRunning(true);
    setTestResults([]);

    try {
      const results: TestResult[] = [];

      // Test 1: Single persona
      try {
        const res = await fetch(`/api/testing/single-persona?company_id=${selectedCompany}`);
        const data = await res.json();
        results.push({
          testName: 'Single Persona Test',
          passed: data.success,
          message: data.message,
          details: data.details,
        });
      } catch (error: any) {
        results.push({
          testName: 'Single Persona Test',
          passed: false,
          message: error.message,
        });
      }

      // Test 2: Many personas
      try {
        const res = await fetch(`/api/testing/many-personas?company_id=${selectedCompany}`);
        const data = await res.json();
        results.push({
          testName: 'Many Personas Test',
          passed: data.success,
          message: data.message,
          details: data.details,
        });
      } catch (error: any) {
        results.push({
          testName: 'Many Personas Test',
          passed: false,
          message: error.message,
        });
      }

      // Test 3: Single subreddit
      try {
        const res = await fetch(`/api/testing/single-subreddit?company_id=${selectedCompany}`);
        const data = await res.json();
        results.push({
          testName: 'Single Subreddit Test',
          passed: data.success,
          message: data.message,
          details: data.details,
        });
      } catch (error: any) {
        results.push({
          testName: 'Single Subreddit Test',
          passed: false,
          message: error.message,
        });
      }

      // Test 4: Many subreddits
      try {
        const res = await fetch(`/api/testing/many-subreddits?company_id=${selectedCompany}`);
        const data = await res.json();
        results.push({
          testName: 'Many Subreddits Test',
          passed: data.success,
          message: data.message,
          details: data.details,
        });
      } catch (error: any) {
        results.push({
          testName: 'Many Subreddits Test',
          passed: false,
          message: error.message,
        });
      }

      // Test 5: Missing tones
      try {
        const res = await fetch(`/api/testing/missing-tones?company_id=${selectedCompany}`);
        const data = await res.json();
        results.push({
          testName: 'Missing Tones Test',
          passed: data.success,
          message: data.message,
          details: data.details,
        });
      } catch (error: any) {
        results.push({
          testName: 'Missing Tones Test',
          passed: false,
          message: error.message,
        });
      }

      // Test 6: Missing company info
      try {
        const res = await fetch(`/api/testing/missing-company-info?company_id=${selectedCompany}`);
        const data = await res.json();
        results.push({
          testName: 'Missing Company Info Test',
          passed: data.success,
          message: data.message,
          details: data.details,
        });
      } catch (error: any) {
        results.push({
          testName: 'Missing Company Info Test',
          passed: false,
          message: error.message,
        });
      }

      // Test 7: Spam and repetition rules
      try {
        const res = await fetch(`/api/testing/spam-rules?company_id=${selectedCompany}`);
        const data = await res.json();
        results.push({
          testName: 'Spam Rules Validation',
          passed: data.success,
          message: data.message,
          details: data.details,
        });
      } catch (error: any) {
        results.push({
          testName: 'Spam Rules Validation',
          passed: false,
          message: error.message,
        });
      }

      setTestResults(results);
    } catch (error) {
      console.error('Test execution error:', error);
    } finally {
      setRunning(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const res = await fetch('/api/companies');
      const data = await res.json();
      setCompanies(data.companies || []);
    } catch (error) {
      console.error('Failed to load companies:', error);
    }
  };

  useState(() => {
    loadCompanies();
  });

  const passedCount = testResults.filter(r => r.passed).length;
  const totalCount = testResults.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Testing Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">Run automated tests on edge cases</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="border rounded px-3 py-2 flex-1"
            >
              <option value="">Select a company...</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            <button
              onClick={runTests}
              disabled={running || !selectedCompany}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {running ? 'Running Tests...' : 'Run All Tests'}
            </button>
          </div>

          {totalCount > 0 && (
            <div className="mt-4 p-4 bg-gray-50 rounded">
              <p className="text-sm font-medium">
                Results: {passedCount}/{totalCount} tests passed
              </p>
              <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${(passedCount / totalCount) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {testResults.map((result, index) => (
            <div
              key={index}
              className={`bg-white rounded-lg shadow p-6 ${
                result.passed ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{result.testName}</h3>
                  <p className="text-sm text-gray-600 mt-1">{result.message}</p>
                  {result.details && (
                    <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                      <pre>{JSON.stringify(result.details, null, 2)}</pre>
                    </div>
                  )}
                </div>
                <span
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    result.passed
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {result.passed ? 'PASSED' : 'FAILED'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {testResults.length === 0 && !running && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500">Select a company and run tests to see results</p>
          </div>
        )}
      </main>
    </div>
  );
}

