'use client';

import { useState, useEffect } from 'react';
import { accounts } from '@/lib/data';
import { calculateHealthScore } from '@/lib/utils';

export default function Home() {
  const [selectedAccount, setSelectedAccount] = useState(accounts[0]);
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [thinkingMessage, setThinkingMessage] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAnalysis('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleAnalysis = async (type: string) => {
    setLoading(true);
    
    const thinkingMessages: Record<string, string> = {
      health: 'Analyzing account health signals across usage, support, and engagement patterns...',
      expansion: 'Identifying expansion opportunities and calculating ARR lift potential...',
      briefing: 'Synthesizing executive summary with risk assessment and strategic recommendations...',
      email: 'Composing personalized outreach based on recent account activity...',
    };
    setThinkingMessage(thinkingMessages[type]);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: selectedAccount, type }),
      });
      const data = await response.json();
      
      if (!response.ok) {
        setAnalysis(`ERROR: ${data.error}\nDetails: ${data.details || 'No details'}`);
      } else {
        setAnalysis(data.analysis || 'No analysis returned');
      }
    } catch (error: any) {
      setAnalysis(`ERROR: ${error.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">🏠 Lighthouse</h1>
        <p className="text-gray-600 mb-8">AI-powered account intelligence for Enterprise Customer Success teams</p>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold mb-4">Portfolio Health</h2>
            {accounts.map(acc => {
              const health = calculateHealthScore(acc);
              return (
                <button
                  key={acc.id}
                  onClick={() => setSelectedAccount(acc)}
                  className={`w-full text-left p-3 rounded mb-2 transition-all ${
                    selectedAccount.id === acc.id 
                      ? 'bg-blue-50 border-2 border-blue-500 shadow-sm' 
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{acc.name}</span>
                    <span className="text-lg">
                      {health >= 70 ? '🟢' : health >= 50 ? '🟡' : '🔴'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-gray-500">{health}/100</span>
                    <span className="text-xs text-gray-400">${(acc.arr / 1000).toFixed(0)}K ARR</span>
                  </div>
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
                  <p className="text-sm text-gray-500">Seat Utilization</p>
                  <p className="text-xl font-semibold">
                    {Math.round((selectedAccount.seats_active/selectedAccount.seats_total)*100)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">NPS</p>
                  <p className="text-xl font-semibold">{selectedAccount.nps_score}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Health Score</p>
                  <p className="text-xl font-semibold">{calculateHealthScore(selectedAccount)}/100</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t flex items-center space-x-6 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">Analysis Confidence:</span>
                  <span className="font-semibold text-green-600">
                    {calculateHealthScore(selectedAccount) >= 70 ? 'High' : 
                     calculateHealthScore(selectedAccount) >= 50 ? 'Medium' : 'Elevated Risk'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">Data Quality:</span>
                  <span className="font-semibold text-blue-600">Complete</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">Last Updated:</span>
                  <span className="font-semibold text-gray-700">Live</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold mb-4">AI Intelligence Layer</h3>
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button 
                  onClick={() => handleAnalysis('health')} 
                  className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition font-medium"
                  disabled={loading}
                >
                  🤖 Health Analysis
                </button>
                <button 
                  onClick={() => handleAnalysis('expansion')} 
                  className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition font-medium"
                  disabled={loading}
                >
                  📈 Expansion Plays
                </button>
                <button 
                  onClick={() => handleAnalysis('briefing')} 
                  className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition font-medium"
                  disabled={loading}
                >
                  📄 Executive Briefing
                </button>
                <button 
                  onClick={() => handleAnalysis('email')} 
                  className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition font-medium"
                  disabled={loading}
                >
                  ✉️ Draft Email
                </button>
              </div>

              {loading && (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-blue-100">
                  <div className="inline-flex items-center space-x-3">
                    <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                    <span className="text-sm text-gray-700 font-medium">{thinkingMessage}</span>
                  </div>
                </div>
              )}

              {analysis && !loading && (
                <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-semibold text-gray-900">Analysis Results</h4>
                    <button 
                      onClick={() => setAnalysis('')}
                      className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
                    >
                      Clear (ESC)
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">{analysis}</pre>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="fixed bottom-4 right-4 text-xs text-gray-500 bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
          Press <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">ESC</span> to clear analysis
        </div>
      </div>
    </div>
  );
}
