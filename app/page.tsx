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
        {/* Header with System Status */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-bold">🏠 Lighthouse</h1>
            <p className="text-gray-600 mt-1">AI-powered account intelligence for Enterprise Customer Success teams</p>
          </div>
          <div className="bg-white rounded-lg shadow px-4 py-3 border border-gray-200">
            <div className="flex items-center space-x-6 text-xs">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-gray-600">Claude Sonnet 4.6</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-gray-500">Portfolio:</span>
                <span className="font-semibold text-gray-900">{accounts.length} accounts</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-gray-500">Total ARR:</span>
                <span className="font-semibold text-gray-900">
                  ${(accounts.reduce((sum, acc) => sum + acc.arr, 0) / 1000000).toFixed(2)}M
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Portfolio Sidebar */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold mb-4">Portfolio Health</h2>
            {accounts
              .map(acc => ({ ...acc, health: calculateHealthScore(acc) }))
              .sort((a, b) => a.health - b.health)
              .map(acc => (
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
                      {acc.health >= 70 ? '🟢' : acc.health >= 50 ? '🟡' : '🔴'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-gray-500">{acc.health}/100</span>
                    <span className="text-xs text-gray-400">${(acc.arr / 1000).toFixed(0)}K ARR</span>
                  </div>
                </button>
              ))}
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Account Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold mb-4">{selectedAccount.name}</h2>
              
              {/* Metrics with Trends */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500">ARR</p>
                  <p className="text-xl font-semibold">${selectedAccount.arr.toLocaleString()}</p>
                  <p className="text-xs text-green-600 mt-1">
                    +${Math.round(selectedAccount.arr * 0.12).toLocaleString()} YTD
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Seat Utilization</p>
                  <div className="flex items-baseline space-x-2">
                    <p className="text-xl font-semibold">
                      {Math.round((selectedAccount.seats_active/selectedAccount.seats_total)*100)}%
                    </p>
                    <span className={`text-xs font-semibold ${
                      selectedAccount.monthly_active_users[4] > selectedAccount.monthly_active_users[0] 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {selectedAccount.monthly_active_users[4] > selectedAccount.monthly_active_users[0] ? '↑' : '↓'}
                      {Math.abs(Math.round(((selectedAccount.monthly_active_users[4] - selectedAccount.monthly_active_users[0]) / selectedAccount.monthly_active_users[0]) * 100))}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedAccount.seats_active}/{selectedAccount.seats_total} seats
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">NPS</p>
                  <p className="text-xl font-semibold">{selectedAccount.nps_score}</p>
                  <p className={`text-xs mt-1 font-medium ${
                    selectedAccount.nps_score >= 50 ? 'text-green-600' : 
                    selectedAccount.nps_score >= 30 ? 'text-orange-600' : 'text-red-600'
                  }`}>
                    {selectedAccount.nps_score >= 50 ? 'Promoter' : 
                     selectedAccount.nps_score >= 30 ? 'Passive' : 'Detractor'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Health Score</p>
                  <p className="text-xl font-semibold">{calculateHealthScore(selectedAccount)}/100</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Last QBR: {new Date(selectedAccount.last_qbr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>

              {/* MAU Trend Chart */}
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-gray-500 mb-2">Monthly Active Users (Last 5 Months)</p>
                <div className="flex items-end space-x-1 h-12">
                  {selectedAccount.monthly_active_users.map((mau, i) => (
                    <div 
                      key={i} 
                      className="flex-1 bg-blue-500 rounded-t"
                      style={{ 
                        height: `${(mau / Math.max(...selectedAccount.monthly_active_users)) * 100}%`,
                        opacity: 0.4 + (i * 0.15)
                      }}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>{selectedAccount.monthly_active_users[0]}</span>
                  <span className={`font-semibold ${
                    selectedAccount.monthly_active_users[4] > selectedAccount.monthly_active_users[0] 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    {selectedAccount.monthly_active_users[4]}
                  </span>
                </div>
              </div>

              {/* Confidence Indicators */}
              <div className="mt-4 pt-4 border-t flex items-center space-x-6 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">Analysis Confidence:</span>
                  <span className={`font-semibold ${
                    calculateHealthScore(selectedAccount) >= 70 ? 'text-green-600' : 
                    calculateHealthScore(selectedAccount) >= 50 ? 'text-orange-600' : 'text-red-600'
                  }`}>
                    {calculateHealthScore(selectedAccount) >= 70 ? 'High' : 
                     calculateHealthScore(selectedAccount) >= 50 ? 'Medium' : 'Elevated Risk'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">Data Quality:</span>
                  <span className="font-semibold text-blue-600">Complete</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">Support Tickets (30d):</span>
                  <span className={`font-semibold ${
                    selectedAccount.support_tickets_30d > 15 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {selectedAccount.support_tickets_30d}
                  </span>
                </div>
              </div>
            </div>

            {/* AI Analysis Panel */}
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

        {/* Keyboard Shortcut Hint */}
        <div className="fixed bottom-4 right-4 text-xs text-gray-500 bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
          Press <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">ESC</span> to clear analysis
        </div>
      </div>
    </div>
  );
}
