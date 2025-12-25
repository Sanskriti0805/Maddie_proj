'use client';

import { useState } from 'react';

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error' | 'loading'; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setResult({ type: 'error', message: 'Please select a file' });
      return;
    }

    setLoading(true);
    setResult({ type: 'loading', message: 'Uploading and importing file...' });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/import/unified', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          type: 'success',
          message: `
            ✅ Import Successful!
            ${data.message}
            Company: ${data.data.company.name}
            Personas: ${data.data.personas.length}
            Subreddits: ${data.data.subreddits.length}
            SEO Queries: ${data.data.seoQueries.length}
            Posts: ${data.data.posts}
            Replies: ${data.data.replies}
          `,
        });
      } else {
        setResult({
          type: 'error',
          message: `❌ Import Failed: ${data.error}${data.details ? '\n' + data.details : ''}`,
        });
      }
    } catch (error: any) {
      setResult({
        type: 'error',
        message: `❌ Error: ${error.message}\nMake sure the server is running.`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">📊 Import Excel File</h1>
        <p className="text-gray-600 mb-6">
          Select your Excel file to import company data and calendar.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Excel File
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              required
            />
            {file && (
              <p className="mt-2 text-sm text-gray-600">Selected: {file.name}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !file}
            className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Importing...' : 'Import File'}
          </button>
        </form>

        {result && (
          <div
            className={`mt-6 p-4 rounded-lg ${
              result.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : result.type === 'error'
                ? 'bg-red-50 border border-red-200 text-red-800'
                : 'bg-blue-50 border border-blue-200 text-blue-800'
            }`}
          >
            <pre className="whitespace-pre-wrap text-sm font-mono">{result.message}</pre>
            {result.type === 'success' && (
              <div className="mt-4">
                <a
                  href="/dashboard"
                  className="text-primary-600 hover:text-primary-700 font-medium underline"
                >
                  View Dashboard →
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

