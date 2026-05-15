'use client';

import { useState } from 'react';
import { accounts } from '@/lib/data';
import { calculateHealthScore } from '@/lib/utils';

export default function Home() {
  const [selectedAccount, setSelectedAccount] = useState(accounts[0]);
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAnalysis = async (type: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: selectedAccount, type }),
      });
      const data = await response.json();
      setAnalysis(data.analysis);
    } catch (error) {
      setAnalysis('Error generating analysis.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">🏠 Lighthouse</h1>
        <p className="text-gray-600 mb-8">AI Account Intelligence</p>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold mb-4">Portfolio</h2>
            {accounts.map(acc => {
              const health = calculateHealthScore(acc);
              return (
                <button
                  key={acc.id}
                  onClick={() => setSelectedAccount(acc)}
                  className={`w-full text-left p-3 rounded mb-2 ${
                    selectedAccount.id === acc.id ? 'bg-blue-50 border-2 border-blue-500' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">{acc.name}</span>
                    <span>{health >= 70 ? '🟢' : health >= 50 ? '🟡' : '🔴'}</span>
                  </div>
                  <span className="text-xs text-gray-500">{health}/100</span>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold mb-4">{selectedAccount.name}</h2>
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500">ARR</p>
                  <p className="text-xl font-semibold">${selectedAccount.arr.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Seats</p>
                  <p className="text-xl font-semibold">
                    {Math.round((selectedAccount.seats_active/selectedAccount.seats_total)*100)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">NPS</p>
                  <p className="text-xl font-semibold">{selectedAccount.nps_score}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Health</p>
                  <p className="text-xl font-semibold">{calculateHealthScore(selectedAccount)}/100</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold mb-4">AI Analysis</h3>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button 
                  onClick={() => handleAnalysis('health')} 
                  className="px-4 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
                  disabled={loading}
                >
                  🤖 Health Analysis
                </button>
                <button 
                  onClick={() => handleAnalysis('expansion')} 
                  className="px-4 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
                  disabled={loading}
                >
                  📈 Expansion Plays
                </button>
                <button 
                  onClick={() => handleAnalysis('briefing')} 
                  className="px-4 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
                  disabled={loading}
                >
                  📄 Executive Briefing
                </button>
                <button 
                  onClick={() => handleAnalysis('email')} 
                  className="px-4 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
                  disabled={loading}
                >
                  ✉️ Draft Email
                </button>
              </div>

              {loading && <div className="text-center py-8">Generating analysis...</div>}
              {analysis && !loading && (
                <div className="bg-gray-50 rounded p-4">
                  <pre className="whitespace-pre-wrap text-sm">{analysis}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
